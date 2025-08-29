/**
 * Mükemmel Satranç Oyunu
 * Bu dosya, Nesne Yönelimli Programlama (OOP) kullanarak tüm oyun mantığını yönetir.
 */
class ChessGame {
    // Kurucu metot: Oyun başladığında bir kere çalışır.
    constructor() {
        // DOM elementlerini seç ve sınıf özelliklerine ata
        this.boardElement = document.getElementById('board');
        this.statusElement = document.getElementById('status');
        this.whiteCapturedElement = document.getElementById('white-captured');
        this.blackCapturedElement = document.getElementById('black-captured');
        this.moveHistoryElement = document.getElementById('move-history');
        this.newGameButton = document.getElementById('new-game-button');
        this.promotionModal = document.getElementById('promotion-modal');
        this.promotionChoices = document.getElementById('promotion-choices');

        // Sabitleri tanımla
        this.pieces = {
            'R': { unicode: '&#9814;', color: 'b' }, 'N': { unicode: '&#9816;', color: 'b' }, 'B': { unicode: '&#9815;', color: 'b' }, 'Q': { unicode: '&#9813;', color: 'b' }, 'K': { unicode: '&#9812;', color: 'b' }, 'P': { unicode: '&#9817;', color: 'b' },
            'r': { unicode: '&#9820;', color: 'w' }, 'n': { unicode: '&#9822;', color: 'w' }, 'b': { unicode: '&#9821;', color: 'w' }, 'q': { unicode: '&#9819;', color: 'w' }, 'k': { unicode: '&#9818;', color: 'w' }, 'p': { unicode: '&#9823;', color: 'w' }
        };

        this.initialBoard = [
            ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R'], ['P', 'P', 'P', 'P', 'P', 'P', 'P', 'P'], [' ', ' ', ' ', ' ', ' ', ' ', ' ', ' '], [' ', ' ', ' ', ' ', ' ', ' ', ' ', ' '],
            [' ', ' ', ' ', ' ', ' ', ' ', ' ', ' '], [' ', ' ', ' ', ' ', ' ', ' ', ' ', ' '], ['p', 'p', 'p', 'p', 'p', 'p', 'p', 'p'], ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r']
        ];
        
        // Event listener'ları bağla
        this.newGameButton.addEventListener('click', () => this.initializeGame());

        // Oyunu başlat
        this.initializeGame();
    }

    // Oyunu başlatan veya sıfırlayan ana metot
    initializeGame() {
        // Oyun durumunu (state) sıfırla
        this.boardState = JSON.parse(JSON.stringify(this.initialBoard));
        this.turn = 'w';
        this.selectedPiece = null;
        this.validMoves = [];
        this.castlingRights = { w: { kingside: true, queenside: true }, b: { kingside: true, queenside: true } };
        this.enPassantTarget = null; // Geçerken alma hedef karesi
        this.isGameOver = false;
        this.winner = null;
        this.capturedPieces = { w: [], b: [] };
        this.history = [];

        this.renderAll();
    }

    // Tüm arayüzü güncelleyen ana render metodu
    renderAll() {
        this.renderBoard();
        this.renderCapturedPieces();
        this.renderMoveHistory();
        this.updateStatus();
    }

    // Tahtayı çizer
    renderBoard() {
        this.boardElement.innerHTML = '';
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const square = document.createElement('div');
                square.classList.add('square', (r + c) % 2 === 0 ? 'white' : 'black');
                square.dataset.row = r;
                square.dataset.col = c;

                const pieceChar = this.boardState[r][c];
                if (pieceChar !== ' ') {
                    square.innerHTML = this.pieces[pieceChar].unicode;
                }
                
                square.addEventListener('click', (e) => this.onSquareClick(e));
                this.boardElement.appendChild(square);
            }
        }
        this.highlightValidMoves();
        this.highlightSelectedPiece();
    }
    
    // Alınan taşları panellere çizer
    renderCapturedPieces() {
        this.whiteCapturedElement.innerHTML = this.capturedPieces.w.map(p => this.pieces[p].unicode).join('');
        this.blackCapturedElement.innerHTML = this.capturedPieces.b.map(p => this.pieces[p].unicode).join('');
    }

    // Hamle geçmişini çizer
    renderMoveHistory() {
        this.moveHistoryElement.innerHTML = '';
        this.history.forEach((move, index) => {
            const li = document.createElement('li');
            const moveNumber = Math.floor(index / 2) + 1;
            const prefix = (index % 2 === 0) ? `${moveNumber}. ` : '';
            li.textContent = `${prefix}${move}`;
            this.moveHistoryElement.appendChild(li);
        });
        this.moveHistoryElement.parentElement.scrollTop = this.moveHistoryElement.parentElement.scrollHeight;
    }

    // Durum metnini günceller
    updateStatus() {
        let statusText;
        if (this.isGameOver) {
            if (this.winner === 'Berabere') {
                statusText = "Oyun Bitti: Pat (Beraberlik)!";
            } else {
                statusText = `ŞAH MAT! Kazanan: ${this.winner}`;
            }
        } else {
            statusText = `Sıra ${this.turn === 'w' ? 'Beyaz' : 'Siyah'}'da`;
            if (this.isKingInCheck(this.turn)) {
                statusText += " (ŞAH!)";
            }
        }
        this.statusElement.textContent = statusText;
    }

    // Kareye tıklama olay yöneticisi
    onSquareClick(event) {
        if (this.isGameOver) return;
        const square = event.currentTarget;
        const r = parseInt(square.dataset.row);
        const c = parseInt(square.dataset.col);

        if (this.selectedPiece) {
            const isMoveValid = this.validMoves.some(move => move.r === r && move.c === c);
            if (isMoveValid) {
                this.movePiece(this.selectedPiece.position, { r, c });
                return;
            }
        }
        
        this.deselectPiece();
        const pieceChar = this.boardState[r][c];
        if (pieceChar !== ' ' && this.pieces[pieceChar].color === this.turn) {
            this.selectPiece(square, pieceChar, { r, c });
        }
    }
    
    // Bir taşı seçer
    selectPiece(element, type, position) {
        this.selectedPiece = { element, type, position };
        const potentialMoves = this.getPotentialMoves(type, position);
        this.validMoves = potentialMoves.filter(move => {
            const tempBoard = this.simulateMove(position, move);
            return !this.isKingInCheck(this.turn, tempBoard);
        });
        this.renderBoard();
    }
    
    // Seçimi kaldırır
    deselectPiece() {
        this.selectedPiece = null;
        this.validMoves = [];
    }
    
    // Taşı hareket ettirir
    async movePiece(from, to) {
        const pieceToMove = this.boardState[from.r][from.c];
        const capturedPiece = this.boardState[to.r][to.c];
        let enPassantCapture = false;

        // Hamle kaydını oluştur
        this.logMove(pieceToMove, from, to, capturedPiece);

        if (capturedPiece !== ' ') {
            this.capturedPieces[this.turn].push(capturedPiece);
        }

        // Geçerken alma (En Passant) kontrolü
        if (pieceToMove.toLowerCase() === 'p' && to.r === this.enPassantTarget?.r && to.c === this.enPassantTarget?.c) {
            const capturedPawnPos = { r: from.r, c: to.c };
            const capturedPawn = this.boardState[capturedPawnPos.r][capturedPawnPos.c];
            this.capturedPieces[this.turn].push(capturedPawn);
            this.boardState[capturedPawnPos.r][capturedPawnPos.c] = ' ';
            enPassantCapture = true;
        }
        
        // Piyon 2 kare ileri giderse en passant hedefini ayarla
        if (pieceToMove.toLowerCase() === 'p' && Math.abs(from.r - to.r) === 2) {
            this.enPassantTarget = { r: (from.r + to.r) / 2, c: from.c };
        } else {
            this.enPassantTarget = null;
        }

        // Rok hamlesi
        if (pieceToMove.toLowerCase() === 'k' && Math.abs(from.c - to.c) === 2) {
            this.boardState[to.r][to.c] = pieceToMove;
            this.boardState[from.r][from.c] = ' ';
            const rook = (to.c > from.c) ? this.boardState[from.r][7] : this.boardState[from.r][0];
            const rookDestC = (to.c > from.c) ? 5 : 3;
            const rookStartC = (to.c > from.c) ? 7 : 0;
            this.boardState[from.r][rookDestC] = rook;
            this.boardState[from.r][rookStartC] = ' ';
        } else { // Normal hamle
            this.boardState[to.r][to.c] = pieceToMove;
            this.boardState[from.r][from.c] = ' ';
        }
        
        // Piyon terfisi
        if (pieceToMove.toLowerCase() === 'p' && (to.r === 0 || to.r === 7)) {
            const newPiece = await this.promotePawn(to);
            this.boardState[to.r][to.c] = newPiece;
        }

        this.updateCastlingRights(pieceToMove, from);
        this.turn = (this.turn === 'w') ? 'b' : 'w';
        this.deselectPiece();
        this.checkGameOver();
        this.renderAll();
    }

    // Piyon terfi modal'ını gösterir ve kullanıcı seçimini bekler
    promotePawn(pos) {
        return new Promise(resolve => {
            this.promotionModal.classList.remove('modal-hidden');
            this.promotionChoices.innerHTML = '';
            const choices = this.turn === 'w' ? ['q', 'r', 'b', 'n'] : ['Q', 'R', 'B', 'N'];
            
            choices.forEach(p => {
                const choiceElement = document.createElement('span');
                choiceElement.innerHTML = this.pieces[p].unicode;
                choiceElement.onclick = () => {
                    this.promotionModal.classList.add('modal-hidden');
                    resolve(p);
                };
                this.promotionChoices.appendChild(choiceElement);
            });
        });
    }
    
    // Hamleleri basit notasyonda kaydeder
    logMove(piece, from, to, captured) {
        const pieceName = piece.toLowerCase();
        const fromSquare = `${String.fromCharCode(97 + from.c)}${8 - from.r}`;
        const toSquare = `${String.fromCharCode(97 + to.c)}${8 - to.r}`;
        let moveNotation = `${pieceName === 'p' ? '' : piece.toUpperCase()}${fromSquare}${captured !== ' ' ? 'x' : '-'}${toSquare}`;
        this.history.push(moveNotation);
    }
    
    // [ getPotentialMoves, isSquareUnderAttack, getKingPosition, isKingInCheck, simulateMove, hasAnyLegalMoves, checkGameOver, updateCastlingRights, isInBounds fonksiyonları önceki kod ile büyük ölçüde aynı ]
    // Sadece enPassantTarget kuralı getPotentialMoves'a eklendi.
    getPotentialMoves(piece, pos) {
        const moves = [];
        const type = piece.toLowerCase();
        const color = this.pieces[piece].color;

        if (type === 'p') {
            const dir = (color === 'w') ? -1 : 1;
            const startRow = (color === 'w') ? 6 : 1;
            // 1 kare ileri
            if (this.isInBounds(pos.r + dir, pos.c) && this.boardState[pos.r + dir][pos.c] === ' ') {
                moves.push({ r: pos.r + dir, c: pos.c });
                // 2 kare ileri (başlangıçta)
                if (pos.r === startRow && this.boardState[pos.r + 2 * dir][pos.c] === ' ') {
                    moves.push({ r: pos.r + 2 * dir, c: pos.c });
                }
            }
            // Çapraz yeme
            [-1, 1].forEach(side => {
                const newR = pos.r + dir;
                const newC = pos.c + side;
                if (this.isInBounds(newR, newC)) {
                    // Normal yeme
                    if (this.boardState[newR][newC] !== ' ' && this.pieces[this.boardState[newR][newC]].color !== color) {
                        moves.push({ r: newR, c: newC });
                    }
                    // Geçerken alma (En Passant)
                    if (this.enPassantTarget && newR === this.enPassantTarget.r && newC === this.enPassantTarget.c) {
                        moves.push({ r: newR, c: newC });
                    }
                }
            });
            return moves; // Piyon için özel çıkış
        }
        // ... Diğer taşların hareket mantığı (önceki koddan alınabilir, değişiklik yok) ...
        const movePatterns = {
            'n': [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]],
            'k': [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]]
        };
        const slidePatterns = {
            'r': [[-1, 0], [1, 0], [0, -1], [0, 1]],
            'b': [[-1, -1], [-1, 1], [1, -1], [1, 1]],
            'q': [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [-1, 1], [1, -1], [1, 1]]
        };

        if (movePatterns[type]) {
            movePatterns[type].forEach(m => {
                const newR = pos.r + m[0], newC = pos.c + m[1];
                if (this.isInBounds(newR, newC)) {
                    const target = this.boardState[newR][newC];
                    if (target === ' ' || this.pieces[target].color !== color) moves.push({ r: newR, c: newC });
                }
            });
        }
        if (slidePatterns[type]) {
            slidePatterns[type].forEach(dir => {
                for (let i = 1; i < 8; i++) {
                    const newR = pos.r + dir[0] * i, newC = pos.c + dir[1] * i;
                    if (!this.isInBounds(newR, newC)) break;
                    const target = this.boardState[newR][newC];
                    if (target === ' ') {
                        moves.push({ r: newR, c: newC });
                    } else {
                        if (this.pieces[target].color !== color) moves.push({ r: newR, c: newC });
                        break;
                    }
                }
            });
        }
        if (type === 'k') {
            const rights = this.castlingRights[color];
            const opponentColor = color === 'w' ? 'b' : 'w';
            if (rights.kingside && this.boardState[pos.r][pos.c+1] === ' ' && this.boardState[pos.r][pos.c+2] === ' ' &&
                !this.isSquareUnderAttack(pos.r, pos.c, opponentColor) && !this.isSquareUnderAttack(pos.r, pos.c+1, opponentColor) && !this.isSquareUnderAttack(pos.r, pos.c+2, opponentColor)) {
                moves.push({ r: pos.r, c: pos.c + 2 });
            }
            if (rights.queenside && this.boardState[pos.r][pos.c-1] === ' ' && this.boardState[pos.r][pos.c-2] === ' ' && this.boardState[pos.r][pos.c-3] === ' ' &&
                !this.isSquareUnderAttack(pos.r, pos.c, opponentColor) && !this.isSquareUnderAttack(pos.r, pos.c-1, opponentColor) && !this.isSquareUnderAttack(pos.r, pos.c-2, opponentColor)) {
                moves.push({ r: pos.r, c: pos.c - 2 });
            }
        }
        return moves;
    }
    isSquareUnderAttack(r, c, attackerColor, board = this.boardState) { for (let row = 0; row < 8; row++) { for (let col = 0; col < 8; col++) { const piece = board[row][col]; if (piece !== ' ' && this.pieces[piece].color === attackerColor) { const moves = this.getPotentialMoves(piece, { r: row, c: col }); if (moves.some(move => move.r === r && move.c === c)) { return true; } } } } return false; }
    getKingPosition(color, board = this.boardState) { const kingChar = color === 'w' ? 'k' : 'K'; for (let r = 0; r < 8; r++) { for (let c = 0; c < 8; c++) { if (board[r][c] === kingChar) return { r, c }; } } return null; }
    isKingInCheck(color, board = this.boardState) { const kingPos = this.getKingPosition(color, board); if (!kingPos) return true; return this.isSquareUnderAttack(kingPos.r, kingPos.c, color === 'w' ? 'b' : 'w', board); }
    simulateMove(from, to) { const tempBoard = JSON.parse(JSON.stringify(this.boardState)); tempBoard[to.r][to.c] = tempBoard[from.r][from.c]; tempBoard[from.r][from.c] = ' '; return tempBoard; }
    hasAnyLegalMoves(color) { for (let r = 0; r < 8; r++) { for (let c = 0; c < 8; c++) { const piece = this.boardState[r][c]; if (piece !== ' ' && this.pieces[piece].color === color) { const legalMoves = this.getPotentialMoves(piece, { r, c }).filter(move => !this.isKingInCheck(color, this.simulateMove({ r, c }, move))); if (legalMoves.length > 0) return true; } } } return false; }
    checkGameOver() { if (!this.hasAnyLegalMoves(this.turn)) { this.isGameOver = true; this.winner = this.isKingInCheck(this.turn) ? (this.turn === 'w' ? 'Siyah' : 'Beyaz') : 'Berabere'; } }
    updateCastlingRights(piece, from) { const color = this.pieces[piece].color; if (piece.toLowerCase() === 'k') { this.castlingRights[color].kingside = false; this.castlingRights[color].queenside = false; } else if (piece.toLowerCase() === 'r') { if (from.c === 0 && from.r === (color === 'w' ? 7 : 0)) this.castlingRights[color].queenside = false; if (from.c === 7 && from.r === (color === 'w' ? 7 : 0)) this.castlingRights[color].kingside = false; } }
    isInBounds(r, c) { return r >= 0 && r < 8 && c >= 0 && c < 8; }
    highlightValidMoves() { this.validMoves.forEach(move => { const square = this.boardElement.querySelector(`[data-row='${move.r}'][data-col='${move.c}']`); if (square) { const dot = document.createElement('div'); dot.classList.add(this.boardState[move.r][move.c] !== ' ' || (this.enPassantTarget && move.r === this.enPassantTarget.r && move.c === this.enPassantTarget.c) ? 'valid-capture-dot' : 'valid-move-dot'); square.appendChild(dot); } }); }
    highlightSelectedPiece() { if (this.selectedPiece) { this.boardElement.querySelector(`[data-row='${this.selectedPiece.position.r}'][data-col='${this.selectedPiece.position.c}']`).classList.add('selected'); } }
}

// Sayfa yüklendiğinde yeni bir oyun nesnesi oluşturarak her şeyi başlat.
document.addEventListener('DOMContentLoaded', () => {
    new ChessGame();
});

