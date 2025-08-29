document.addEventListener('DOMContentLoaded', () => {

    // --- DOM Referansları ---
    const boardContainer = document.getElementById('board-container');
    const statusText = document.getElementById('status-text');
    const spinner = document.getElementById('spinner');
    const winsDisplay = document.getElementById('wins');
    const lossesDisplay = document.getElementById('losses');
    const draggedPieceElement = document.getElementById('dragged-piece');
    
    // Modallar ve Butonlar
    const newGameBtn = document.getElementById('new-game-btn');
    const undoBtn = document.getElementById('undo-btn');
    const difficultyBtn = document.getElementById('difficulty-btn');
    const difficultyModal = document.getElementById('difficulty-modal');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const difficultyOptions = document.querySelectorAll('.difficulty-option');
    const gameOverModal = document.getElementById('game-over-modal');
    const gameOverMessage = document.getElementById('game-over-message');
    const modalNewGameBtn = document.getElementById('modal-new-game-btn');

    // --- Oyun Durumu (State) ---
    let gameState = {};
    const defaultState = {
        // Tahta dizisi: 0-63. Beyaz üstte, Siyah altta.
        values: ['r','n','b','q','k','b','n','r','p','p','p','p','p','p','p','p',0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,'o','o','o','o','o','o','o','o','t','m','v','w','l','v','m','t'],
        myTurn: true, // Oyuncu (Siyah) sırası
        previousStates: [],
        score: { wins: 0, losses: 0 },
        difficulty: 'medium',
        lastMove: null, // {from, to}
        enPassantTarget: null, // Geçerken alma hedef karesi
        castlingRights: { wK: true, wQ: true, bK: true, bQ: true } // Rok hakları
    };

    // --- Taş Bilgileri ---
    const fonts = { 'k':'&#9818;', 'q':'&#9819;', 'r':'&#9820;', 'b':'&#9821;', 'n':'&#9822;', 'p':'&#9823;', 'l':'&#9812;', 'w':'&#9813;', 't':'&#9814;', 'v':'&#9815;', 'm':'&#9816;', 'o':'&#9817;' };
    const pieceValues = { 'p': 10, 'n': 30, 'b': 30, 'r': 50, 'q': 90, 'k': 900, 'o': 10, 'm': 30, 'v': 30, 't': 50, 'w': 90, 'l': 900 };
    const WHITE_PIECES = 'prnbqk';
    const BLACK_PIECES = 'otmvlw';


    // --- Dokunmatik Kontrol Değişkenleri ---
    let selectedSquareIndex = null, dragStartIndex = null;
    
    // ============================ OYUN YÖNETİMİ ============================

    function init() {
        createBoardDOM();
        loadGame();
        renderBoard();
        addEventListeners();
        updateStatus();
    }

    function newGame() {
        const currentScore = gameState.score;
        // Derin kopyalama ile defaultState'i sıfırla
        gameState = JSON.parse(JSON.stringify(defaultState));
        gameState.score = currentScore; // Skoru koru
        gameOverModal.classList.add('hidden');
        saveGame();
        renderBoard();
        updateStatus();
    }

    function saveGame() {
        try { localStorage.setItem('chessGameState', JSON.stringify(gameState)); } catch (e) { console.error("Oyun kaydedilemedi:", e); }
    }

    function loadGame() {
        try {
            const savedState = localStorage.getItem('chessGameState');
            gameState = savedState ? JSON.parse(savedState) : JSON.parse(JSON.stringify(defaultState));
        } catch (e) {
            gameState = JSON.parse(JSON.stringify(defaultState));
        }
    }
    
    function undoMove() {
        if (gameOverModal.classList.contains('hidden') && gameState.previousStates.length >= 2) {
            gameState = JSON.parse(gameState.previousStates.pop()); // AI'nin durumunu atla
            gameState = JSON.parse(gameState.previousStates.pop()); // Oyuncunun durumunu yükle
            renderBoard();
            updateStatus();
            saveGame();
        }
    }

    function checkGameOver() {
        const turn = gameState.myTurn ? BLACK_PIECES : WHITE_PIECES;
        const kingPiece = gameState.myTurn ? 'l' : 'k';
        
        const hasLegalMoves = getAllPossibleMoves(turn, gameState.values).length > 0;

        if (!hasLegalMoves) {
            if (isKingInCheck(kingPiece, gameState.values)) {
                // ŞAH-MAT
                if (gameState.myTurn) {
                    showGameOver("Kaybettiniz! (Şah-Mat)");
                    gameState.score.losses++;
                } else {
                    showGameOver("Kazandınız! (Şah-Mat)");
                    gameState.score.wins++;
                }
            } else {
                // PAT (Beraberlik)
                showGameOver("Beraberlik! (Pat)");
            }
            updateStatus();
            saveGame();
            return true;
        }
        return false;
    }
    
    function showGameOver(message) {
        gameOverMessage.textContent = message;
        gameOverModal.classList.remove('hidden');
    }

    // ============================ ARAYÜZ (UI) ============================

    function createBoardDOM() {
        boardContainer.innerHTML = '';
        for (let i = 0; i < 64; i++) {
            const square = document.createElement('div');
            square.dataset.index = i;
            square.classList.add('square');
            const isRowEven = Math.floor(i / 8) % 2 === 0;
            const isColEven = i % 2 === 0;
            square.classList.add((isRowEven && isColEven) || (!isRowEven && !isColEven) ? 'light' : 'dark');
            square.appendChild(document.createElement('div')).classList.add('highlight-overlay');
            boardContainer.appendChild(square);
        }
    }
    
    function renderBoard() {
        const squares = boardContainer.children;
        const possibleMoves = selectedSquareIndex !== null ? getLegalMovesForPiece(selectedSquareIndex, gameState.values) : [];
        
        for (let i = 0; i < 64; i++) {
            const square = squares[i];
            const piece = gameState.values[i];
            
            // Önceki içeriği temizle ama overlay'i koru
            const overlay = square.querySelector('.highlight-overlay') || document.createElement('div');
            if(!square.querySelector('.highlight-overlay')) {
                overlay.classList.add('highlight-overlay');
                square.appendChild(overlay);
            }

            square.innerHTML = piece ? fonts[piece] : '';
            square.appendChild(overlay); 
            
            overlay.className = 'highlight-overlay';
            if (possibleMoves.includes(i)) {
                overlay.classList.add('highlight');
            }
            if (gameState.lastMove && (i === gameState.lastMove.from || i === gameState.lastMove.to)) {
                overlay.classList.add('last-move');
            }
            square.classList.toggle('selected', i === selectedSquareIndex);
        }
    }

    function updateStatus() {
        if (!gameOverModal.classList.contains('hidden')) return;
        statusText.textContent = gameState.myTurn ? "Sıra Sende" : "Bilgisayar Düşünüyor...";
        spinner.classList.toggle('hidden', gameState.myTurn);
        winsDisplay.textContent = gameState.score.wins;
        lossesDisplay.textContent = gameState.score.losses;
    }

    function showInvalidMove(index) {
        boardContainer.children[index].classList.add('invalid-move');
        vibrate(100);
        setTimeout(() => boardContainer.children[index].classList.remove('invalid-move'), 500);
    }
    
    function vibrate(duration) {
        if ('vibrate' in navigator) navigator.vibrate(duration);
    }

    // ============================ OLAY DİNLEYİCİLERİ ============================
    
    function addEventListeners() {
        newGameBtn.addEventListener('click', newGame);
        modalNewGameBtn.addEventListener('click', newGame);
        undoBtn.addEventListener('click', undoMove);
        difficultyBtn.addEventListener('click', () => difficultyModal.classList.remove('hidden'));
        closeModalBtn.addEventListener('click', () => difficultyModal.classList.add('hidden'));

        difficultyOptions.forEach(button => {
            button.addEventListener('click', () => {
                gameState.difficulty = button.dataset.level;
                difficultyOptions.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
                saveGame();
                setTimeout(() => difficultyModal.classList.add('hidden'), 200);
            });
            if (button.dataset.level === gameState.difficulty) button.classList.add('active');
        });
        
        boardContainer.addEventListener('mousedown', handleInteractionStart);
        boardContainer.addEventListener('touchstart', handleInteractionStart, { passive: false });
        document.addEventListener('mousemove', handleInteractionMove);
        document.addEventListener('touchmove', handleInteractionMove, { passive: false });
        document.addEventListener('mouseup', handleInteractionEnd);
        document.addEventListener('touchend', handleInteractionEnd);
    }

    // ============================ KULLANICI ETKİLEŞİM MANTIĞI (TAMAMLANDI) ============================

    function getIndexFromEvent(e) {
        const target = e.type.includes('touch') ? document.elementFromPoint(e.touches[0].clientX, e.touches[0].clientY) : e.target;
        return target.closest('.square')?.dataset.index;
    }

    function handleInteractionStart(e) {
        if (!gameState.myTurn) return;
        
        const index = parseInt(getIndexFromEvent(e));
        if (isNaN(index)) return;

        const piece = gameState.values[index];
        if (piece && BLACK_PIECES.includes(piece)) {
            e.preventDefault();
            dragStartIndex = index;
            selectedSquareIndex = index;
            createDraggedPiece(e, piece);
            renderBoard();
        }
    }

    function handleInteractionMove(e) {
        if (dragStartIndex === null) return;
        e.preventDefault();
        const { clientX, clientY } = e.type.includes('touch') ? e.touches[0] : e;
        draggedPieceElement.style.left = `${clientX}px`;
        draggedPieceElement.style.top = `${clientY}px`;
    }

    function handleInteractionEnd(e) {
        if (dragStartIndex === null) return;

        const endIndex = parseInt(getIndexFromEvent(e));
        
        // Sürüklenen görseli temizle
        draggedPieceElement.style.display = 'none';
        
        if (!isNaN(endIndex) && dragStartIndex !== endIndex) {
            // Sürükleyip bırakma
            handleMove(dragStartIndex, endIndex);
        } else if (dragStartIndex === endIndex) {
            // Sadece tıklama
            selectedSquareIndex = (selectedSquareIndex === dragStartIndex) ? null : dragStartIndex;
            renderBoard();
        } else {
            // Tahtanın dışına bırakma, seçimi iptal et
             selectedSquareIndex = null;
             renderBoard();
        }

        dragStartIndex = null;
    }
    
    function createDraggedPiece(e, piece) {
        const { clientX, clientY } = e.type.includes('touch') ? e.touches[0] : e;
        draggedPieceElement.innerHTML = fonts[piece];
        draggedPieceElement.style.display = 'block';
        draggedPieceElement.style.left = `${clientX}px`;
        draggedPieceElement.style.top = `${clientY}px`;
    }


    // ============================ OYUN MANTIĞI ============================
    
    function makeMove(from, to, values, rights) {
        const newValues = [...values];
        const newRights = JSON.parse(JSON.stringify(rights));
        const piece = newValues[from];

        // En Passant
        if (piece.toLowerCase() === 'o' && to === gameState.enPassantTarget) {
            newValues[to + 8] = 0; // Siyah piyon için rakip piyonu al
        } else if (piece.toLowerCase() === 'p' && to === gameState.enPassantTarget) {
            newValues[to - 8] = 0; // Beyaz piyon için
        }
        
        newValues[to] = piece;
        newValues[from] = 0;

        // Rok
        if (piece === 'l' && Math.abs(from - to) === 2) { // Siyah Rok
            if (to > from) { // Kısa rok (g1 -> 62)
                newValues[61] = newValues[63]; newValues[63] = 0;
            } else { // Uzun rok (c1 -> 58)
                newValues[59] = newValues[56]; newValues[56] = 0;
            }
        }
        if (piece === 'k' && Math.abs(from - to) === 2) { // Beyaz Rok
            if (to > from) { // Kısa rok (g8 -> 6)
                newValues[5] = newValues[7]; newValues[7] = 0;
            } else { // Uzun rok (c8 -> 2)
                newValues[3] = newValues[0]; newValues[0] = 0;
            }
        }

        // Rok haklarını güncelle
        if (piece === 'l') { newRights.bK = newRights.bQ = false; }
        if (piece === 'k') { newRights.wK = newRights.wQ = false; }
        if (from === 0 || to === 0) { newRights.wQ = false; }
        if (from === 7 || to === 7) { newRights.wK = false; }
        if (from === 56 || to === 56) { newRights.bQ = false; }
        if (from === 63 || to === 63) { newRights.bK = false; }
        
        return { values: newValues, rights: newRights };
    }

    function handleMove(from, to) {
        const possibleMoves = getLegalMovesForPiece(from, gameState.values);
        if (!possibleMoves.includes(to)) {
            showInvalidMove(to);
            selectedSquareIndex = null;
            renderBoard();
            return;
        }
        
        // Geçerli hamle, durumu kaydet
        gameState.previousStates.push(JSON.stringify(gameState));
        
        // Hamleyi yap
        const { values, rights } = makeMove(from, to, gameState.values, gameState.castlingRights);
        gameState.values = values;
        gameState.castlingRights = rights;
        
        // Piyon terfisi (Siyah)
        if (gameState.values[to] === "o" && to < 8) gameState.values[to] = "w"; // Vezire terfi
        
        // Bir sonraki tur için En Passant hedefi ayarla
        gameState.enPassantTarget = (gameState.values[to] === 'o' && from - to === 16) ? from - 8 : null;
        
        gameState.lastMove = { from, to };
        gameState.myTurn = false;
        selectedSquareIndex = null;
        vibrate(50);
        
        renderBoard();
        updateStatus();
        
        if (checkGameOver()) return;
        
        saveGame();
        setTimeout(aiTurn, 250);
    }

    function aiTurn() {
        const move = chooseAiMove();
        if (!move) {
            checkGameOver(); // Hamle yoksa oyun bitmiş olabilir.
            return;
        }

        gameState.previousStates.push(JSON.stringify(gameState));
        
        const { values, rights } = makeMove(move.from, move.to, gameState.values, gameState.castlingRights);
        gameState.values = values;
        gameState.castlingRights = rights;
        
        // Piyon terfisi (Beyaz)
        if (gameState.values[move.to] === "p" && move.to >= 56) gameState.values[move.to] = "q";
        
        // En Passant hedefi
        gameState.enPassantTarget = (gameState.values[move.to] === 'p' && move.to - move.from === 16) ? move.from + 8 : null;

        gameState.lastMove = { from: move.from, to: move.to };
        gameState.myTurn = true;
        
        renderBoard();
        updateStatus();
        
        checkGameOver();
        saveGame();
    }

    function chooseAiMove() {
        const allMoves = getAllPossibleMoves(WHITE_PIECES, gameState.values);
        if (allMoves.length === 0) return null;

        if (gameState.difficulty === 'easy') {
            return allMoves[Math.floor(Math.random() * allMoves.length)];
        }

        let bestMove = null;
        let bestScore = -Infinity;

        for (const move of allMoves) {
            const { values: tempValues } = makeMove(move.from, move.to, gameState.values, gameState.castlingRights);
            let score = 0;
            const capturedPiece = gameState.values[move.to];
            
            if (gameState.difficulty === 'medium') {
                score = (capturedPiece ? pieceValues[capturedPiece.toLowerCase()] : 0) + Math.random() * 2 - 1; // Küçük bir rastgelelik
            } else { // Hard ve Very Hard
                let moveScore = capturedPiece ? pieceValues[capturedPiece.toLowerCase()] : 0;
                
                // Rakibin en iyi cevabını bul ve skordan çıkar (minimax)
                const opponentMoves = getAllPossibleMoves(BLACK_PIECES, tempValues);
                let bestOpponentReplyScore = 0;
                for (const oppMove of opponentMoves) {
                    const captured = tempValues[oppMove.to];
                    const replyScore = captured ? pieceValues[captured.toLowerCase()] : 0;
                    if (replyScore > bestOpponentReplyScore) {
                        bestOpponentReplyScore = replyScore;
                    }
                }
                moveScore -= bestOpponentReplyScore * (gameState.difficulty === 'very-hard' ? 0.9 : 0.5); 
                score = moveScore;
            }
            
            if (score > bestScore) {
                bestScore = score;
                bestMove = move;
            }
        }
        return bestMove || allMoves[0];
    }
    
    // ============================ SATRANÇ KURAL MOTORU (TAMAMLANDI) ============================
    
    function getAllPossibleMoves(pieceSet, currentValues) {
        const moves = [];
        for (let i = 0; i < 64; i++) {
            if (currentValues[i] !== 0 && pieceSet.includes(currentValues[i])) {
                const pieceMoves = getLegalMovesForPiece(i, currentValues);
                pieceMoves.forEach(to => moves.push({ from: i, to }));
            }
        }
        return moves;
    }

    function getLegalMovesForPiece(index, currentValues) {
        const piece = currentValues[index];
        if (!piece) return [];

        const isWhite = WHITE_PIECES.includes(piece);
        const kingPiece = isWhite ? 'k' : 'l';

        // 1. Önce o taşın gidebileceği tüm teorik kareleri bul
        const pseudoLegalMoves = getPseudoLegalMoves(index, currentValues);

        // 2. Her bir teorik hamleyi dene ve şahın tehlikede olup olmadığını kontrol et
        const legalMoves = pseudoLegalMoves.filter(to => {
            const { values: tempBoard } = makeMove(index, to, currentValues, gameState.castlingRights);
            return !isKingInCheck(kingPiece, tempBoard);
        });

        return legalMoves;
    }

    function getPseudoLegalMoves(index, currentValues) {
        const piece = currentValues[index];
        const row = Math.floor(index / 8), col = index % 8;
        const moves = [];
        const isWhite = WHITE_PIECES.includes(piece);
        const enemyPieces = isWhite ? BLACK_PIECES : WHITE_PIECES;

        const addMove = (r, c) => {
            if (r >= 0 && r < 8 && c >= 0 && c < 8) {
                const targetIndex = r * 8 + c;
                const targetPiece = currentValues[targetIndex];
                if (targetPiece === 0) {
                    moves.push(targetIndex);
                    return true; // Boş kare, devam edebilir
                } else if (enemyPieces.includes(targetPiece)) {
                    moves.push(targetIndex);
                    return false; // Rakip taş, al ama devam etme
                }
            }
            return false; // Tahta dışı veya kendi taşı
        };

        const addSlideMoves = (directions) => {
            for (const [dr, dc] of directions) {
                let r = row + dr, c = col + dc;
                while(addMove(r, c)) { r += dr; c += dc; }
            }
        };

        switch (piece.toLowerCase()) {
            case 'p': // Beyaz Piyon
                if (currentValues[index + 8] === 0) { moves.push(index + 8); }
                if (row === 1 && currentValues[index + 8] === 0 && currentValues[index + 16] === 0) { moves.push(index + 16); }
                if (col > 0 && enemyPieces.includes(currentValues[index + 7])) { moves.push(index + 7); }
                if (col < 7 && enemyPieces.includes(currentValues[index + 9])) { moves.push(index + 9); }
                if (index + 7 === gameState.enPassantTarget || index + 9 === gameState.enPassantTarget) { moves.push(gameState.enPassantTarget); }
                break;
            case 'o': // Siyah Piyon
                if (currentValues[index - 8] === 0) { moves.push(index - 8); }
                if (row === 6 && currentValues[index - 8] === 0 && currentValues[index - 16] === 0) { moves.push(index - 16); }
                if (col > 0 && enemyPieces.includes(currentValues[index - 9])) { moves.push(index - 9); }
                if (col < 7 && enemyPieces.includes(currentValues[index - 7])) { moves.push(index - 7); }
                 if (index - 7 === gameState.enPassantTarget || index - 9 === gameState.enPassantTarget) { moves.push(gameState.enPassantTarget); }
                break;
            case 'n': case 'm': // At
                [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]].forEach(([dr, dc]) => addMove(row + dr, col + dc));
                break;
            case 'b': case 'v': // Fil
                addSlideMoves([[-1,-1],[-1,1],[1,-1],[1,1]]);
                break;
            case 'r': case 't': // Kale
                addSlideMoves([[-1,0],[1,0],[0,-1],[0,1]]);
                break;
            case 'q': case 'w': // Vezir
                addSlideMoves([[-1,-1],[-1,1],[1,-1],[1,1],[-1,0],[1,0],[0,-1],[0,1]]);
                break;
            case 'k': case 'l': // Şah
                [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]].forEach(([dr, dc]) => addMove(row + dr, col + dc));
                // Rok Kontrolü
                const king = isWhite ? 'k' : 'l';
                const rights = gameState.castlingRights;
                if(isKingInCheck(king, currentValues)) break;

                if (isWhite && rights.wK && !currentValues[5] && !currentValues[6] && !isSquareAttacked(5, enemyPieces, currentValues) && !isSquareAttacked(6, enemyPieces, currentValues)) moves.push(6);
                if (isWhite && rights.wQ && !currentValues[1] && !currentValues[2] && !currentValues[3] && !isSquareAttacked(2, enemyPieces, currentValues) && !isSquareAttacked(3, enemyPieces, currentValues)) moves.push(2);
                if (!isWhite && rights.bK && !currentValues[61] && !currentValues[62] && !isSquareAttacked(61, enemyPieces, currentValues) && !isSquareAttacked(62, enemyPieces, currentValues)) moves.push(62);
                if (!isWhite && rights.bQ && !currentValues[57] && !currentValues[58] && !currentValues[59] && !isSquareAttacked(58, enemyPieces, currentValues) && !isSquareAttacked(59, enemyPieces, currentValues)) moves.push(58);
                break;
        }
        return moves;
    }

    function isKingInCheck(kingPiece, currentValues) {
        const kingIndex = currentValues.indexOf(kingPiece);
        if (kingIndex === -1) return true; // Şah yoksa, mat olmuş demektir.
        const isWhite = WHITE_PIECES.includes(kingPiece);
        const enemyPieces = isWhite ? BLACK_PIECES : WHITE_PIECES;
        return isSquareAttacked(kingIndex, enemyPieces, currentValues);
    }

    function isSquareAttacked(index, byPieceSet, currentValues) {
        // Rakip taşların bu kareye saldırıp saldırmadığını kontrol et
        for (let i = 0; i < 64; i++) {
            if (currentValues[i] !== 0 && byPieceSet.includes(currentValues[i])) {
                // Şah kontrolünü atlayarak pseudo-legal hamleleri alıyoruz, sonsuz döngüyü önlemek için.
                const moves = getPseudoLegalMoves(i, currentValues);
                if (moves.includes(index)) return true;
            }
        }
        return false;
    }
    
    // --- Oyunu Başlat ---
    init();
});
