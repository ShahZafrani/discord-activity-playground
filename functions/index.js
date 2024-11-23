// The Cloud Functions for Firebase SDK to create Cloud Functions and triggers.
// const {logger} = require("firebase-functions");
const {onRequest} = require("firebase-functions/v2/https");
const {onDocumentUpdated} = require("firebase-functions/v2/firestore");

// The Firebase Admin SDK to access Firestore.
const {initializeApp} = require("firebase-admin/app");
const {getFirestore, Timestamp} = require("firebase-admin/firestore");
const axios = require("axios");
const {defineSecret} = require("firebase-functions/params");
const discordClientId = defineSecret("zain_test_discord_id");
const discordClientSecret = defineSecret("zain_test_discord_secret");

initializeApp();

exports.authorizeDiscord = onRequest({secrets: [discordClientId, discordClientSecret]}, async (req, res) => {
  // Exchange the code for an access_token
  const clientId = discordClientId.value();
  // if it's empty, throw an error
  if (clientId.length === 0) {
    console.error("⚠️ client id is not set");
    res.sendStatus(400);
  }
  // get the second secret key value
  const clientSecret = discordClientSecret.value();
  // if it's empty, throw an error
  if (clientSecret.length === 0) {
    console.error("⚠️ client secret is not set");
    res.sendStatus(400);
  }
  const response = await axios.post(`https://discord.com/api/oauth2/token`, new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "authorization_code",
    code: req.body.code,
  }), {headers: {
    "Content-Type": "application/x-www-form-urlencoded",
  }});

  // Retrieve the access_token from the response
  const responseData = response.data;

  // Return the access_token to our client as { access_token: "..."}
  res.send({access_token: responseData.access_token});
});

exports.createNewGame = onRequest(async (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers",
      "Origin, X-Requested-With, Content-Type, Accept");
  if (req.method === "OPTIONS") {
    res.status(200).send();
  }
  if (req.query.id) {
    const now = Timestamp.fromDate(new Date());
    const newGame = createEmptyGame();
    newGame.gameBegin = now;
    newGame.players.red.uid = req.query.id;
    getFirestore()
        .collection("games")
        .add(newGame).then((ref) => {
          ref.collection("moves").add({description: "gameStart", timestamp: now});
          ref.collection("player_moves").doc("gm").set({timestamp: now});
          ref.collection("player_moves").doc(req.query.id).set({timestamp: now});
          return res.status(201).send({gameId: ref.id});
        }).catch((error) => {
          res.status(500).send(error);
        });
  } else {
    return res.status(400).send(`InvalidID: ${req.query}`);
  }
});

exports.joinExistingGame = onRequest(async (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  if (req.method === "OPTIONS") {
    res.status(200).send();
  }
  // todo: this should be done in a transaction to avoid multiple writes
  if (req.query.gameId) {
    const gameDoc = await getFirestore().doc(`games/${req.query.gameId}`).get();
    const playerMoves = gameDoc._ref.collection(`/player_moves`);
    playerMoves.doc(req.query.playerId).set({timestamp: Timestamp.fromDate(new Date())});
    const updatedPlayers = gameDoc.data().players;
    updatedPlayers.blue.uid = req.query.playerId;
    gameDoc._ref.update({players: updatedPlayers});
    gameDoc._ref.update({turn_uid: updatedPlayers.red.uid});
    return res.status(200).send({gameId: gameDoc.id});
  } else {
    return res.status(400).send(`InvalidID: ${req.body}`);
  }
});

exports.getCards = onRequest((req, res) => {
  res.send(cards);
});


// cardChoice "boar"
// (string)
// cardOption "b"
// (string)
// gamePiece "b2"
// (string)
// uid "ZYa1b4pUxFNBZbdgiPltlkFcoYM2"

exports.onMoveUpdate= onDocumentUpdated("games/{gameId}/player_moves/{uid}", (event) => {
  const move = event.data.after.data();
  const gameRef = event.data.after.ref.parent.parent;
  const write = gameRef.get().then((snap) => {
    const game = snap.data();
    const player = whichPlayer(game.players, event.params.userId);
    const validity = validateMove(game, move, player);
    let message = "";
    // const destroyed = "";
    // const isWin = false;
    let victor = null;
    const newPlayers = game.players;
    let newTableCard = game.tableCard;
    const newBoard = game.board;
    let nextTurn = game.players[player].uid;
    if (validity !== "valid") {
      message = `Player ${player} made an invalid move: ${validity}`;
    } else {
      const from = getFromSpace(newBoard, move.gamePiece);
      const to = getLandingSpace(newBoard, move, player);
      const destroyed = newBoard[to];
      victor = checkForWin(to, player, move.gamePiece, destroyed);
      newBoard[to] = move.gamePiece;
      newBoard[from] = "";
      const otherPlayer = player === "red" ? "blue" : "red";
      message = victor === null ? `Player ${player} played the card: ${move.cardChoice},
       and move the piece ${move.gamePiece} from ${from} to ${to}.${destroyedText(destroyed)}` :
        `${player}: "Omae Wa Mo Shinderu.", ${otherPlayer}: "NANI!"`;
      nextTurn = victor === null ? game.players[otherPlayer].uid : "game_over";
      newTableCard = move.cardChoice;
      const oldCardIndex = newPlayers[player].hand.indexOf(move.cardChoice);
      newPlayers[player].hand.splice(oldCardIndex, 1);
      newPlayers[player].hand.push(game.tableCard);
    }
    game.gameStatus = message;
    return gameRef.set(
        {gameStatus: message,
          board: newBoard,
          turn_uid: nextTurn,
          victor: victor,
          tableCard: newTableCard,
          players: newPlayers}
        , {merge: true});
  }).catch((error) => {
    console.log(error);
  });
  return write;
});

function destroyedText(destroyed) {
  if (destroyed !== "") {
    return ` ${destroyed} was slain!`;
  }
  return destroyed;
}


function whichPlayer(players, uid) {
  if (players.red.uid !== uid) {
    return "blue";
  }
  return "red";
}

function validateMove(game, move, playerColor) {
  if (!isInDeck(game.deck, move.cardChoice)) {
    return "card not in deck";
  }
  if (!isInPlayerHand(game.players, move.cardChoice, playerColor)) {
    return "card not in player hand";
  }
  if (move.gamePiece[0] !== playerColor[0]) {
    return "Player tried to move a piece that is not theirs";
  }
  const to = getLandingSpace(game.board, move, playerColor);
  const spaceValidity = isSpaceValid(game.board, to, playerColor);
  if (spaceValidity !== "valid") {
    return spaceValidity;
  }
  if (!matchesCardOption(move.cardChoice, move.cardOption)) {
    return "invalid card option";
  }
  return "valid";
}

function getLandingSpace(board, move, playerColor) {
  const fromSpace = getFromSpace(board, move.gamePiece);

  const cardCoords = cards[move.cardChoice].options[move.cardOption];
  const newX = speculativeX(fromSpace[0], cardCoords.y, playerColor);
  if (newX === "invalid") {
    return "invalid xPos";
  }
  const newY = speculativeY(fromSpace[1], cardCoords.x, playerColor);
  if (newY === "invalid") {
    return "invalid yPos";
  }
  return String(newX) + String(newY);
}

function speculativeX(fromX, xDiff, playerColor) {
  const xi = letters.indexOf(fromX);
  xDiff *= playerColor === "blue" ? -1 : 1;
  const newXi = xi + parseInt(xDiff);
  if (newXi < 0 || newXi > 4) {
    return "invalid";
  }
  return letters[newXi];
}

function speculativeY(fromY, yDiff, playerColor) {
  yDiff *= playerColor === "red" ? -1 : 1;
  const toY = parseInt(fromY) + parseInt(yDiff);
  if (toY < 0 || toY > 4) {
    return "invalid";
  }
  return toY;
}

function getFromSpace(board, piece) {
  let fromSpace = "";
  Object.entries(board).map((space) => {
    if (space[1] === piece) {
      fromSpace = space[0];
    }
  });
  return fromSpace;
}

function isInDeck(deck, card) {
  if (Object.keys(deck).includes(card)) {
    return true;
  }
  return false;
}

function isInPlayerHand(players, card, player) {
  if (players[player].hand.includes(card)) {
    return true;
  }
  return false;
}

function isSpaceValid(board, to, playerColor) {
  if (to.length > 2) {
    return to;
  }
  const existingSpace = board[to];
  if (existingSpace !== "" && existingSpace[0] === playerColor[0]) {
    return "invalid space: cannot move onto your own piece";
  }
  return "valid";
}

function matchesCardOption(card, option) {
  return cards[card].options[option] !== undefined;
}

const cards = {
  tiger: {
    flavorText: "rawr",
    options: {
      a: {
        x: 0,
        y: 2,
      },
      b: {
        x: 0,
        y: -1,
      },
    },
  },
  crab: {
    flavorText: "crab people crab people",
    options: {
      a: {
        x: 0,
        y: 1,
      },
      b: {
        x: 2,
        y: 0,
      },
      c: {
        x: -2,
        y: 0,
      },
    },
  },
  horse: {
    flavorText: "power of friendship",
    options: {
      a: {
        x: 0,
        y: 1,
      },
      b: {
        x: 0,
        y: -1,
      },
      c: {
        x: -1,
        y: 0,
      },
    },
  },
  frog: {
    flavorText: "leap",
    options: {
      a: {
        x: -1,
        y: 1,
      },
      b: {
        x: -2,
        y: 0,
      },
      c: {
        x: 1,
        y: -1,
      },
    },
  },
  rooster: {
    flavorText: "cockadoodle doo",
    options: {
      a: {
        x: 1,
        y: 1,
      },
      b: {
        x: 1,
        y: 0,
      },
      c: {
        x: -1,
        y: 0,
      },
      d: {
        x: -1,
        y: -1,
      },
    },
  },
  elephant: {
    flavorText: "cage the",
    options: {
      a: {
        x: 1,
        y: 1,
      },
      b: {
        x: 1,
        y: 0,
      },
      c: {
        x: -1,
        y: 0,
      },
      d: {
        x: -1,
        y: 1,
      },
    },
  },
  ox: {
    flavorText: "xoxo",
    options: {
      a: {
        x: 0,
        y: 1,
      },
      b: {
        x: 1,
        y: 0,
      },
      c: {
        x: 0,
        y: -1,
      },
    },
  },
  rabbit: {
    flavorText: "Zip-a-dee-doo-dah, Zip-a-dee-ay!",
    options: {
      a: {
        x: 1,
        y: 1,
      },
      b: {
        x: 2,
        y: 0,
      },
      c: {
        x: -1,
        y: -1,
      },
    },
  },
  cobra: {
    flavorText: "the evolved form of ekans",
    options: {
      a: {
        x: 1,
        y: 1,
      },
      b: {
        x: 1,
        y: -1,
      },
      c: {
        x: -1,
        y: 0,
      },
    },
  },
  mantis: {
    flavorText: "why my arms so long?",
    options: {
      a: {
        x: 1,
        y: 1,
      },
      b: {
        x: 0,
        y: -1,
      },
      c: {
        x: -1,
        y: 1,
      },
    },
  },
  monkey: {
    flavorText: "this *mmokney-man* is a good *m-m-monkey-man* game",
    options: {
      a: {
        x: 1,
        y: 1,
      },
      b: {
        x: 1,
        y: -1,
      },
      c: {
        x: -1,
        y: 1,
      },
      d: {
        x: -1,
        y: -1,
      },
    },
  },
  dragon: {
    flavorText: "DRAGON, DRAGON! Not Lizard. I don't do that tongue thing.",
    options: {
      a: {
        x: 2,
        y: 1,
      },
      b: {
        x: -2,
        y: 1,
      },
      c: {
        x: 1,
        y: -1,
      },
      d: {
        x: -1,
        y: -1,
      },
    },
  },
  boar: {
    flavorText: "like a pig, but scary",
    options: {
      a: {
        x: 1,
        y: 0,
      },
      b: {
        x: -1,
        y: 0,
      },
      c: {
        x: 0,
        y: 1,
      },
    },
  },
  eel: {
    flavorText: "dang, now I'm in the mood for unagi-don",
    options: {
      a: {
        x: -1,
        y: 1,
      },
      b: {
        x: -1,
        y: -1,
      },
      c: {
        x: 1,
        y: 0,
      },
    },
  },
  crane: {
    flavorText: "why we only get construction gigs?",
    options: {
      a: {
        x: 1,
        y: -1,
      },
      b: {
        x: -1,
        y: -1,
      },
      c: {
        x: 0,
        y: 1,
      },
    },
  },
  goose: {
    flavorText: "can't eat my liver if I destroy it first *hiccup*",
    options: {
      a: {
        x: 1,
        y: -1,
      },
      b: {
        x: 1,
        y: 0,
      },
      c: {
        x: -1,
        y: 1,
      },
      d: {
        x: -1,
        y: 0,
      },
    },
  },
};

const letters = ["a", "b", "c", "d", "e"];

function generateBoard() {
  const b = {};
  for (let i = 0; i < 5; i ++) {
    for (let j = 0; j < 5; j ++) {
      b[letters[i] + j] = "";
    }
  }
  for (let j = 0; j < 5; j ++) {
    b["a" + j] = "r" + j;
    b["e" + j] = "b" + j;
  }
  return b;
}

function createEmptyGame() {
  const g = {};
  g.board = generateBoard();
  g.deck = randomSelectCards(cards, 5);
  const cardKeys = Object.keys(g.deck);
  // g.gameBegin = getFirestore.Timestamp.fromDate(new Date());
  g.turn_uid = "";
  g.players = {
    red: {
      hand: [cardKeys[0], cardKeys[1]],
      uid: "",
    },
    blue: {
      hand: [cardKeys[2], cardKeys[3]],
      uid: "",
    },
  };
  g.tableCard = cardKeys[4];
  return g;
}

function randomSelectCards(cardSet, numToSelect) {
  const keys = Object.keys(cardSet);
  const selected = {};
  for (let i = 0; i < numToSelect; i++) {
    const sel = Math.floor(Math.random() * Math.floor(keys.length));
    const card = cardSet[keys[sel]];
    selected[keys[sel]] = card;
    keys.splice(sel, 1);
  }
  return selected;
}

function checkForWin(to, player, piece, destroyed) {
  if (destroyed[1] === "2") {
    return player;
  }
  const victorySpace = player === "red" ? "e2" : "a2";
  if (piece[1] === "2" && to === victorySpace) {
    return player;
  }
  return null;
}
