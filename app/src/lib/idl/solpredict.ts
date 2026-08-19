/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/solpredict.json`.
 */
export type Solpredict = {
  "address": "AWbRCjgFzoe3zMqtXxRzPz7zFo8PP34RLDYmpd8LyGKG",
  "metadata": {
    "name": "solpredict",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "SOLPredict — Decentralized Prediction Market on Solana"
  },
  "instructions": [
    {
      "name": "addGuardian",
      "docs": [
        "Register a new distinct guardian for the emergency-unpause multisig",
        "(admin-only). Up to 3 guardians can be registered."
      ],
      "discriminator": [
        167,
        189,
        170,
        27,
        74,
        240,
        201,
        241
      ],
      "accounts": [
        {
          "name": "admin",
          "writable": true,
          "signer": true
        },
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "emergencyPause",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  109,
                  101,
                  114,
                  103,
                  101,
                  110,
                  99,
                  121,
                  95,
                  112,
                  97,
                  117,
                  115,
                  101
                ]
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "newGuardian",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "addLiquidity",
      "docs": [
        "Add liquidity to a market and receive YES/NO tokens + LP position."
      ],
      "discriminator": [
        181,
        157,
        89,
        67,
        143,
        182,
        52,
        72
      ],
      "accounts": [
        {
          "name": "provider",
          "writable": true,
          "signer": true
        },
        {
          "name": "market",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  97,
                  114,
                  107,
                  101,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "market.market_id",
                "account": "market"
              }
            ]
          }
        },
        {
          "name": "treasury",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  114,
                  101,
                  97,
                  115,
                  117,
                  114,
                  121
                ]
              },
              {
                "kind": "account",
                "path": "market"
              }
            ]
          }
        },
        {
          "name": "yesMint",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  121,
                  101,
                  115,
                  95,
                  109,
                  105,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "market"
              }
            ]
          }
        },
        {
          "name": "noMint",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  110,
                  111,
                  95,
                  109,
                  105,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "market"
              }
            ]
          }
        },
        {
          "name": "providerYesAta",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "provider"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "yesMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "providerNoAta",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "provider"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "noMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "liquidityPosition",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  108,
                  112
                ]
              },
              {
                "kind": "account",
                "path": "market"
              },
              {
                "kind": "account",
                "path": "provider"
              }
            ]
          }
        },
        {
          "name": "emergencyPause",
          "docs": [
            "Optional emergency-pause account. When present and paused, trading is halted."
          ],
          "optional": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "yesLamports",
          "type": "u64"
        },
        {
          "name": "noLamports",
          "type": "u64"
        }
      ]
    },
    {
      "name": "approveMarket",
      "docs": [
        "Approve a pending market proposal and create the market (admin-only)."
      ],
      "discriminator": [
        195,
        83,
        73,
        224,
        150,
        237,
        150,
        5
      ],
      "accounts": [
        {
          "name": "admin",
          "writable": true,
          "signer": true
        },
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "proposal",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  112,
                  111,
                  115,
                  97,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "proposal.proposal_id",
                "account": "marketProposal"
              }
            ]
          }
        },
        {
          "name": "proposalVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  112,
                  111,
                  115,
                  97,
                  108,
                  95,
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "proposal.proposal_id",
                "account": "marketProposal"
              }
            ]
          }
        },
        {
          "name": "proposer",
          "writable": true
        },
        {
          "name": "market",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  97,
                  114,
                  107,
                  101,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "proposal.proposal_id",
                "account": "marketProposal"
              }
            ]
          }
        },
        {
          "name": "yesMint",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  121,
                  101,
                  115,
                  95,
                  109,
                  105,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "market"
              }
            ]
          }
        },
        {
          "name": "noMint",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  110,
                  111,
                  95,
                  109,
                  105,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "market"
              }
            ]
          }
        },
        {
          "name": "treasury",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  114,
                  101,
                  97,
                  115,
                  117,
                  114,
                  121
                ]
              },
              {
                "kind": "account",
                "path": "market"
              }
            ]
          }
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "rent",
          "address": "SysvarRent111111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "batchSettle",
      "docs": [
        "Batch-settle multiple markets in one transaction (admin-only)."
      ],
      "discriminator": [
        176,
        160,
        44,
        84,
        68,
        211,
        201,
        218
      ],
      "accounts": [
        {
          "name": "admin",
          "writable": true,
          "signer": true
        },
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "outcomes",
          "type": "bytes"
        }
      ]
    },
    {
      "name": "buyShares",
      "docs": [
        "Buy YES or NO shares on a market."
      ],
      "discriminator": [
        40,
        239,
        138,
        154,
        8,
        37,
        106,
        108
      ],
      "accounts": [
        {
          "name": "buyer",
          "docs": [
            "Buyer — signs and pays SOL."
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "market",
          "docs": [
            "Market PDA — must be Open and not expired."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  97,
                  114,
                  107,
                  101,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "market.market_id",
                "account": "market"
              }
            ]
          }
        },
        {
          "name": "treasury",
          "docs": [
            "Treasury PDA — receives SOL payment."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  114,
                  101,
                  97,
                  115,
                  117,
                  114,
                  121
                ]
              },
              {
                "kind": "account",
                "path": "market"
              }
            ]
          }
        },
        {
          "name": "yesMint",
          "docs": [
            "YES token mint — may or may not be the one we mint to (depends on side)."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  121,
                  101,
                  115,
                  95,
                  109,
                  105,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "market"
              }
            ]
          }
        },
        {
          "name": "noMint",
          "docs": [
            "NO token mint."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  110,
                  111,
                  95,
                  109,
                  105,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "market"
              }
            ]
          }
        },
        {
          "name": "buyerYesAta",
          "docs": [
            "Buyer's ATA for the chosen mint — init_if_needed since this may be",
            "the buyer's first purchase of this token."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "buyer"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "yesMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "buyerNoAta",
          "docs": [
            "Buyer's ATA for NO mint."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "buyer"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "noMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "userPosition",
          "docs": [
            "UserPosition PDA — init_if_needed for first-time buyers.",
            "Seeds: [\"position\", market, buyer]"
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  115,
                  105,
                  116,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "market"
              },
              {
                "kind": "account",
                "path": "buyer"
              }
            ]
          }
        },
        {
          "name": "emergencyPause",
          "docs": [
            "Optional emergency-pause account. When present and paused, trading is",
            "halted. Absent when the program has never been paused."
          ],
          "optional": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "side",
          "type": {
            "defined": {
              "name": "side"
            }
          }
        },
        {
          "name": "quantity",
          "type": "u64"
        },
        {
          "name": "maxCostLamports",
          "type": "u64"
        }
      ]
    },
    {
      "name": "cancelMarket",
      "docs": [
        "Cancel an open market (admin-only)."
      ],
      "discriminator": [
        205,
        121,
        84,
        210,
        222,
        71,
        150,
        11
      ],
      "accounts": [
        {
          "name": "admin",
          "signer": true
        },
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "market",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  97,
                  114,
                  107,
                  101,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "market.market_id",
                "account": "market"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "reason",
          "type": "string"
        }
      ]
    },
    {
      "name": "cancelOrder",
      "docs": [
        "Cancel an open limit order and reclaim escrowed SOL or tokens."
      ],
      "discriminator": [
        95,
        129,
        237,
        240,
        8,
        49,
        223,
        132
      ],
      "accounts": [
        {
          "name": "maker",
          "writable": true,
          "signer": true
        },
        {
          "name": "market",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  97,
                  114,
                  107,
                  101,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "market.market_id",
                "account": "market"
              }
            ]
          }
        },
        {
          "name": "order",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  111,
                  114,
                  100,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "market"
              },
              {
                "kind": "account",
                "path": "maker"
              },
              {
                "kind": "account",
                "path": "order.order_id",
                "account": "order"
              }
            ]
          }
        },
        {
          "name": "makerTokenAta",
          "writable": true
        },
        {
          "name": "orderTokenEscrow",
          "writable": true
        },
        {
          "name": "orderEscrow",
          "docs": [
            "Data-less SOL escrow for limit BUY orders — refunded to the maker on",
            "cancel. Unused for sell orders."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  111,
                  114,
                  100,
                  101,
                  114,
                  95,
                  101,
                  115,
                  99,
                  114,
                  111,
                  119
                ]
              },
              {
                "kind": "account",
                "path": "market"
              },
              {
                "kind": "account",
                "path": "maker"
              },
              {
                "kind": "account",
                "path": "order.order_id",
                "account": "order"
              }
            ]
          }
        },
        {
          "name": "emergencyPause",
          "docs": [
            "Optional emergency-pause account. When present and paused, trading is halted."
          ],
          "optional": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "claimRefund",
      "docs": [
        "Claim a full refund on a cancelled market."
      ],
      "discriminator": [
        15,
        16,
        30,
        161,
        255,
        228,
        97,
        60
      ],
      "accounts": [
        {
          "name": "claimer",
          "docs": [
            "User claiming refund."
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "market",
          "docs": [
            "Market — must be Cancelled."
          ],
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  97,
                  114,
                  107,
                  101,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "market.market_id",
                "account": "market"
              }
            ]
          }
        },
        {
          "name": "treasury",
          "docs": [
            "Treasury PDA — refunds SOL to user."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  114,
                  101,
                  97,
                  115,
                  117,
                  114,
                  121
                ]
              },
              {
                "kind": "account",
                "path": "market"
              }
            ]
          }
        },
        {
          "name": "yesMint",
          "docs": [
            "YES mint."
          ],
          "writable": true
        },
        {
          "name": "noMint",
          "docs": [
            "NO mint."
          ],
          "writable": true
        },
        {
          "name": "claimerYesAta",
          "docs": [
            "User's YES token ATA."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "claimer"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "yesMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "claimerNoAta",
          "docs": [
            "User's NO token ATA."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "claimer"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "noMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "userPosition",
          "docs": [
            "UserPosition PDA — double-refund guard and rent recovery."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  115,
                  105,
                  116,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "market"
              },
              {
                "kind": "account",
                "path": "claimer"
              }
            ]
          }
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "claimRewards",
      "docs": [
        "Claim pro-rata SOL rewards on a settled market (winners only)."
      ],
      "discriminator": [
        4,
        144,
        132,
        71,
        116,
        23,
        151,
        80
      ],
      "accounts": [
        {
          "name": "claimer",
          "writable": true,
          "signer": true
        },
        {
          "name": "market",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  97,
                  114,
                  107,
                  101,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "market.market_id",
                "account": "market"
              }
            ]
          }
        },
        {
          "name": "treasury",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  114,
                  101,
                  97,
                  115,
                  117,
                  114,
                  121
                ]
              },
              {
                "kind": "account",
                "path": "market"
              }
            ]
          }
        },
        {
          "name": "winningMint",
          "writable": true
        },
        {
          "name": "claimerAta",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "claimer"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "winningMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "userPosition",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  115,
                  105,
                  116,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "market"
              },
              {
                "kind": "account",
                "path": "claimer"
              }
            ]
          }
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "closePosition",
      "docs": [
        "Close UserPosition PDA after market resolution and reclaim ~0.0015 SOL rent deposit."
      ],
      "discriminator": [
        123,
        134,
        81,
        0,
        49,
        68,
        98,
        98
      ],
      "accounts": [
        {
          "name": "user",
          "docs": [
            "Position owner reclaiming rent."
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "market",
          "docs": [
            "Market — must NOT be Open (trading must be ended/settled/cancelled)."
          ],
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  97,
                  114,
                  107,
                  101,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "market.market_id",
                "account": "market"
              }
            ]
          }
        },
        {
          "name": "userPosition",
          "docs": [
            "UserPosition PDA — closed and rent sent back to user."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  115,
                  105,
                  116,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "market"
              },
              {
                "kind": "account",
                "path": "user"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "emergencyPause",
      "docs": [
        "Emergency-pause the entire program to halt trading (admin-only)."
      ],
      "discriminator": [
        21,
        143,
        27,
        142,
        200,
        181,
        210,
        255
      ],
      "accounts": [
        {
          "name": "admin",
          "writable": true,
          "signer": true
        },
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "emergencyPause",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  109,
                  101,
                  114,
                  103,
                  101,
                  110,
                  99,
                  121,
                  95,
                  112,
                  97,
                  117,
                  115,
                  101
                ]
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "emergencyUnpause",
      "docs": [
        "Unpause the program (requires verified guardian signers passed as",
        "remaining accounts)."
      ],
      "discriminator": [
        83,
        249,
        195,
        57,
        206,
        189,
        31,
        85
      ],
      "accounts": [
        {
          "name": "admin",
          "writable": true,
          "signer": true
        },
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "emergencyPause",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  109,
                  101,
                  114,
                  103,
                  101,
                  110,
                  99,
                  121,
                  95,
                  112,
                  97,
                  117,
                  115,
                  101
                ]
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "emergencyWithdraw",
      "docs": [
        "Emergency withdrawal of funds from a settled or paused market (admin-only)."
      ],
      "discriminator": [
        239,
        45,
        203,
        64,
        150,
        73,
        218,
        92
      ],
      "accounts": [
        {
          "name": "admin",
          "writable": true,
          "signer": true
        },
        {
          "name": "market",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  97,
                  114,
                  107,
                  101,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "market.market_id",
                "account": "market"
              }
            ]
          }
        },
        {
          "name": "treasury",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  114,
                  101,
                  97,
                  115,
                  117,
                  114,
                  121
                ]
              },
              {
                "kind": "account",
                "path": "market"
              }
            ]
          }
        },
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "emergencyPause",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  109,
                  101,
                  114,
                  103,
                  101,
                  110,
                  99,
                  121,
                  95,
                  112,
                  97,
                  117,
                  115,
                  101
                ]
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "fillOrder",
      "docs": [
        "Match/fill an open limit order (P2P trade)."
      ],
      "discriminator": [
        232,
        122,
        115,
        25,
        199,
        143,
        136,
        162
      ],
      "accounts": [
        {
          "name": "taker",
          "writable": true,
          "signer": true
        },
        {
          "name": "maker",
          "writable": true
        },
        {
          "name": "market",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  97,
                  114,
                  107,
                  101,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "market.market_id",
                "account": "market"
              }
            ]
          }
        },
        {
          "name": "order",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  111,
                  114,
                  100,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "market"
              },
              {
                "kind": "account",
                "path": "maker"
              },
              {
                "kind": "account",
                "path": "order.order_id",
                "account": "order"
              }
            ]
          }
        },
        {
          "name": "takerTokenAta",
          "writable": true
        },
        {
          "name": "makerTokenAta",
          "writable": true
        },
        {
          "name": "orderTokenEscrow",
          "writable": true
        },
        {
          "name": "orderEscrow",
          "docs": [
            "Data-less SOL escrow for limit BUY orders — the source of the maker's",
            "payment. For sell orders this account is unused (tokens are escrowed in",
            "order_token_escrow instead)."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  111,
                  114,
                  100,
                  101,
                  114,
                  95,
                  101,
                  115,
                  99,
                  114,
                  111,
                  119
                ]
              },
              {
                "kind": "account",
                "path": "market"
              },
              {
                "kind": "account",
                "path": "maker"
              },
              {
                "kind": "account",
                "path": "order.order_id",
                "account": "order"
              }
            ]
          }
        },
        {
          "name": "emergencyPause",
          "docs": [
            "Optional emergency-pause account. When present and paused, trading is halted."
          ],
          "optional": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "quantity",
          "type": "u64"
        }
      ]
    },
    {
      "name": "initializeConfig",
      "docs": [
        "One-time program bootstrap. Sets admin and fee percentage."
      ],
      "discriminator": [
        208,
        127,
        21,
        1,
        194,
        190,
        196,
        70
      ],
      "accounts": [
        {
          "name": "admin",
          "docs": [
            "The caller who will become the program admin."
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "config",
          "docs": [
            "Config PDA — singleton, created once.",
            "Seeds: [\"config\"]"
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "feeBps",
          "type": "u16"
        }
      ]
    },
    {
      "name": "initializeMarket",
      "docs": [
        "Create a new prediction market (admin-only)."
      ],
      "discriminator": [
        35,
        35,
        189,
        193,
        155,
        48,
        170,
        203
      ],
      "accounts": [
        {
          "name": "admin",
          "docs": [
            "Admin signer — must match `config.admin`."
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "config",
          "docs": [
            "Config PDA — read admin + increment market_count."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "market",
          "docs": [
            "Market PDA — created for this market.",
            "Seeds: [\"market\", market_id.to_le_bytes()]",
            "market_id = config.market_count (before increment)"
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  97,
                  114,
                  107,
                  101,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "config.market_count",
                "account": "config"
              }
            ]
          }
        },
        {
          "name": "yesMint",
          "docs": [
            "YES token mint — mint authority = Market PDA (trustless minting).",
            "Seeds: [\"yes_mint\", market.key()]"
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  121,
                  101,
                  115,
                  95,
                  109,
                  105,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "market"
              }
            ]
          }
        },
        {
          "name": "noMint",
          "docs": [
            "NO token mint — mint authority = Market PDA (trustless minting).",
            "Seeds: [\"no_mint\", market.key()]"
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  110,
                  111,
                  95,
                  109,
                  105,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "market"
              }
            ]
          }
        },
        {
          "name": "treasury",
          "docs": [
            "Treasury PDA — holds market's SOL pool.",
            "Seeds: [\"treasury\", market.key()]",
            "SystemAccount: no data, just holds lamports."
          ],
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  114,
                  101,
                  97,
                  115,
                  117,
                  114,
                  121
                ]
              },
              {
                "kind": "account",
                "path": "market"
              }
            ]
          }
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "rent",
          "address": "SysvarRent111111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "question",
          "type": "string"
        },
        {
          "name": "description",
          "type": "string"
        },
        {
          "name": "category",
          "type": "u8"
        },
        {
          "name": "oracleFeedId",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "targetPrice",
          "type": "i64"
        },
        {
          "name": "targetExpo",
          "type": "i32"
        },
        {
          "name": "comparison",
          "type": "u8"
        },
        {
          "name": "endTs",
          "type": "i64"
        },
        {
          "name": "resolveTs",
          "type": "i64"
        },
        {
          "name": "sharePriceLamports",
          "type": "u64"
        }
      ]
    },
    {
      "name": "mockCreatePriceUpdate",
      "docs": [
        "Create mock Pyth PriceUpdateV2 account data (devnet-only, never ship to mainnet)."
      ],
      "discriminator": [
        103,
        162,
        52,
        4,
        77,
        138,
        211,
        58
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "priceUpdate",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  111,
                  99,
                  107,
                  95,
                  112,
                  114,
                  105,
                  99,
                  101,
                  95,
                  102,
                  101,
                  101,
                  100
                ]
              },
              {
                "kind": "account",
                "path": "payer"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "feedId",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "price",
          "type": "i64"
        },
        {
          "name": "conf",
          "type": "u64"
        },
        {
          "name": "exponent",
          "type": "i32"
        },
        {
          "name": "publishTime",
          "type": "i64"
        }
      ]
    },
    {
      "name": "placeOrder",
      "docs": [
        "Place an on-chain limit order (Bid or Ask) for a prediction outcome."
      ],
      "discriminator": [
        51,
        194,
        155,
        175,
        109,
        130,
        96,
        106
      ],
      "accounts": [
        {
          "name": "maker",
          "writable": true,
          "signer": true
        },
        {
          "name": "market",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  97,
                  114,
                  107,
                  101,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "market.market_id",
                "account": "market"
              }
            ]
          }
        },
        {
          "name": "order",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  111,
                  114,
                  100,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "market"
              },
              {
                "kind": "account",
                "path": "maker"
              },
              {
                "kind": "arg",
                "path": "orderId"
              }
            ]
          }
        },
        {
          "name": "makerTokenAta",
          "writable": true
        },
        {
          "name": "orderTokenEscrow",
          "writable": true
        },
        {
          "name": "orderEscrow",
          "docs": [
            "Data-less SOL escrow for limit BUY orders (seeds: [\"order_escrow\",",
            "market, maker, order_id]). Holds the escrowed lamports so fill/cancel",
            "can pay out with a CPI system transfer. Created implicitly by the",
            "maker's transfer in the handler."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  111,
                  114,
                  100,
                  101,
                  114,
                  95,
                  101,
                  115,
                  99,
                  114,
                  111,
                  119
                ]
              },
              {
                "kind": "account",
                "path": "market"
              },
              {
                "kind": "account",
                "path": "maker"
              },
              {
                "kind": "arg",
                "path": "orderId"
              }
            ]
          }
        },
        {
          "name": "emergencyPause",
          "docs": [
            "Optional emergency-pause account. When present and paused, trading is halted."
          ],
          "optional": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "orderId",
          "type": "u64"
        },
        {
          "name": "side",
          "type": {
            "defined": {
              "name": "side"
            }
          }
        },
        {
          "name": "isBuy",
          "type": "bool"
        },
        {
          "name": "priceBps",
          "type": "u64"
        },
        {
          "name": "quantity",
          "type": "u64"
        }
      ]
    },
    {
      "name": "proposeMarket",
      "docs": [
        "Propose a new prediction market (anyone can propose)."
      ],
      "discriminator": [
        39,
        201,
        255,
        2,
        194,
        181,
        58,
        105
      ],
      "accounts": [
        {
          "name": "proposer",
          "writable": true,
          "signer": true
        },
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "proposal",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  112,
                  111,
                  115,
                  97,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "config.market_count",
                "account": "config"
              }
            ]
          }
        },
        {
          "name": "proposalVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  112,
                  111,
                  115,
                  97,
                  108,
                  95,
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "config.market_count",
                "account": "config"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "question",
          "type": "string"
        },
        {
          "name": "description",
          "type": "string"
        },
        {
          "name": "category",
          "type": "u8"
        },
        {
          "name": "oracleFeedId",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "targetPrice",
          "type": "i64"
        },
        {
          "name": "targetExpo",
          "type": "i32"
        },
        {
          "name": "comparison",
          "type": "u8"
        },
        {
          "name": "endTs",
          "type": "i64"
        },
        {
          "name": "resolveTs",
          "type": "i64"
        },
        {
          "name": "sharePriceLamports",
          "type": "u64"
        }
      ]
    },
    {
      "name": "rejectMarket",
      "docs": [
        "Reject a pending market proposal: close it on-chain and slash its bond (admin-only)."
      ],
      "discriminator": [
        214,
        108,
        186,
        227,
        122,
        62,
        61,
        43
      ],
      "accounts": [
        {
          "name": "admin",
          "writable": true,
          "signer": true
        },
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "proposal",
          "docs": [
            "MarketProposal PDA — closed and rent sent back to the admin."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  112,
                  111,
                  115,
                  97,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "proposal.proposal_id",
                "account": "marketProposal"
              }
            ]
          }
        },
        {
          "name": "proposalVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  112,
                  111,
                  115,
                  97,
                  108,
                  95,
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "proposal.proposal_id",
                "account": "marketProposal"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "removeGuardian",
      "docs": [
        "Remove a guardian from the emergency-unpause multisig (admin-only).",
        "Rejected if the removal would leave fewer guardians than the required",
        "confirmations threshold."
      ],
      "discriminator": [
        72,
        117,
        160,
        244,
        155,
        185,
        71,
        18
      ],
      "accounts": [
        {
          "name": "admin",
          "writable": true,
          "signer": true
        },
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "emergencyPause",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  109,
                  101,
                  114,
                  103,
                  101,
                  110,
                  99,
                  121,
                  95,
                  112,
                  97,
                  117,
                  115,
                  101
                ]
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "guardian",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "removeLiquidity",
      "docs": [
        "Remove liquidity and burn LP tokens, receiving SOL back."
      ],
      "discriminator": [
        80,
        85,
        209,
        72,
        24,
        206,
        177,
        108
      ],
      "accounts": [
        {
          "name": "provider",
          "writable": true,
          "signer": true
        },
        {
          "name": "market",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  97,
                  114,
                  107,
                  101,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "market.market_id",
                "account": "market"
              }
            ]
          }
        },
        {
          "name": "treasury",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  114,
                  101,
                  97,
                  115,
                  117,
                  114,
                  121
                ]
              },
              {
                "kind": "account",
                "path": "market"
              }
            ]
          }
        },
        {
          "name": "yesMint",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  121,
                  101,
                  115,
                  95,
                  109,
                  105,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "market"
              }
            ]
          }
        },
        {
          "name": "noMint",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  110,
                  111,
                  95,
                  109,
                  105,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "market"
              }
            ]
          }
        },
        {
          "name": "providerYesAta",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "provider"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "yesMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "providerNoAta",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "provider"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "noMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "liquidityPosition",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  108,
                  112
                ]
              },
              {
                "kind": "account",
                "path": "market"
              },
              {
                "kind": "account",
                "path": "provider"
              }
            ]
          }
        },
        {
          "name": "emergencyPause",
          "docs": [
            "Optional emergency-pause account. When present and paused, trading is halted."
          ],
          "optional": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "lpTokensToBurn",
          "type": "u64"
        }
      ]
    },
    {
      "name": "sellShares",
      "docs": [
        "Sell YES or NO shares back to the pool before market expiry."
      ],
      "discriminator": [
        184,
        164,
        169,
        16,
        231,
        158,
        199,
        196
      ],
      "accounts": [
        {
          "name": "seller",
          "writable": true,
          "signer": true
        },
        {
          "name": "market",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  97,
                  114,
                  107,
                  101,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "market.market_id",
                "account": "market"
              }
            ]
          }
        },
        {
          "name": "treasury",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  114,
                  101,
                  97,
                  115,
                  117,
                  114,
                  121
                ]
              },
              {
                "kind": "account",
                "path": "market"
              }
            ]
          }
        },
        {
          "name": "yesMint",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  121,
                  101,
                  115,
                  95,
                  109,
                  105,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "market"
              }
            ]
          }
        },
        {
          "name": "noMint",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  110,
                  111,
                  95,
                  109,
                  105,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "market"
              }
            ]
          }
        },
        {
          "name": "sellerYesAta",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "seller"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "yesMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "sellerNoAta",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "seller"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "noMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "userPosition",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  115,
                  105,
                  116,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "market"
              },
              {
                "kind": "account",
                "path": "seller"
              }
            ]
          }
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "emergencyPause",
          "docs": [
            "Optional emergency-pause account. When present and paused, trading is halted."
          ],
          "optional": true
        }
      ],
      "args": [
        {
          "name": "side",
          "type": {
            "defined": {
              "name": "side"
            }
          }
        },
        {
          "name": "quantity",
          "type": "u64"
        },
        {
          "name": "minProceedsLamports",
          "type": "u64"
        }
      ]
    },
    {
      "name": "setGuardianThreshold",
      "docs": [
        "Set how many distinct guardian signatures are required to unpause",
        "(admin-only). Must be between 1 and the number of registered guardians."
      ],
      "discriminator": [
        85,
        225,
        97,
        126,
        126,
        73,
        15,
        44
      ],
      "accounts": [
        {
          "name": "admin",
          "writable": true,
          "signer": true
        },
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "emergencyPause",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  109,
                  101,
                  114,
                  103,
                  101,
                  110,
                  99,
                  121,
                  95,
                  112,
                  97,
                  117,
                  115,
                  101
                ]
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "newThreshold",
          "type": "u8"
        }
      ]
    },
    {
      "name": "settleMarket",
      "docs": [
        "Settle a market using a Pyth oracle price (admin-only)."
      ],
      "discriminator": [
        193,
        153,
        95,
        216,
        166,
        6,
        144,
        217
      ],
      "accounts": [
        {
          "name": "admin",
          "docs": [
            "Program admin — the only party allowed to settle. Prevents third",
            "parties from front-running settlement with a stale oracle price."
          ],
          "signer": true
        },
        {
          "name": "market",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  97,
                  114,
                  107,
                  101,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "market.market_id",
                "account": "market"
              }
            ]
          }
        },
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "priceUpdate",
          "docs": [
            "the account data, verifies feed ID, staleness, and confidence."
          ]
        }
      ],
      "args": []
    },
    {
      "name": "settleMarketManual",
      "docs": [
        "Settle a market manually (admin-only)."
      ],
      "discriminator": [
        164,
        135,
        165,
        159,
        9,
        65,
        193,
        253
      ],
      "accounts": [
        {
          "name": "admin",
          "signer": true
        },
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "market",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  97,
                  114,
                  107,
                  101,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "market.market_id",
                "account": "market"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "outcome",
          "type": "u8"
        }
      ]
    },
    {
      "name": "updateAdmin",
      "docs": [
        "Transfer platform admin authority to a new wallet (admin-only)."
      ],
      "discriminator": [
        161,
        176,
        40,
        213,
        60,
        184,
        179,
        228
      ],
      "accounts": [
        {
          "name": "admin",
          "docs": [
            "Current admin signer — must match `config.admin`."
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "config",
          "docs": [
            "Config PDA — its `admin` field is overwritten."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "newAdmin",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "updateMarket",
      "docs": [
        "Update market parameters (admin-only)."
      ],
      "discriminator": [
        153,
        39,
        2,
        197,
        179,
        50,
        199,
        217
      ],
      "accounts": [
        {
          "name": "admin",
          "writable": true,
          "signer": true
        },
        {
          "name": "market",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  97,
                  114,
                  107,
                  101,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "market.market_id",
                "account": "market"
              }
            ]
          }
        },
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "question",
          "type": {
            "option": "string"
          }
        },
        {
          "name": "description",
          "type": {
            "option": "string"
          }
        },
        {
          "name": "category",
          "type": {
            "option": "u8"
          }
        },
        {
          "name": "endTs",
          "type": {
            "option": "i64"
          }
        },
        {
          "name": "resolveTs",
          "type": {
            "option": "i64"
          }
        },
        {
          "name": "sharePriceLamports",
          "type": {
            "option": "u64"
          }
        }
      ]
    },
    {
      "name": "withdrawFees",
      "docs": [
        "Withdraw collected protocol fees from a settled market (admin-only)."
      ],
      "discriminator": [
        198,
        212,
        171,
        109,
        144,
        215,
        174,
        89
      ],
      "accounts": [
        {
          "name": "admin",
          "writable": true,
          "signer": true
        },
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "market",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  97,
                  114,
                  107,
                  101,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "market.market_id",
                "account": "market"
              }
            ]
          }
        },
        {
          "name": "treasury",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  114,
                  101,
                  97,
                  115,
                  117,
                  114,
                  121
                ]
              },
              {
                "kind": "account",
                "path": "market"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    }
  ],
  "accounts": [
    {
      "name": "config",
      "discriminator": [
        155,
        12,
        170,
        224,
        30,
        250,
        204,
        130
      ]
    },
    {
      "name": "emergencyPause",
      "discriminator": [
        189,
        168,
        191,
        242,
        126,
        143,
        137,
        18
      ]
    },
    {
      "name": "liquidityPosition",
      "discriminator": [
        153,
        56,
        106,
        34,
        55,
        42,
        113,
        176
      ]
    },
    {
      "name": "market",
      "discriminator": [
        219,
        190,
        213,
        55,
        0,
        227,
        198,
        154
      ]
    },
    {
      "name": "marketProposal",
      "discriminator": [
        22,
        198,
        69,
        191,
        38,
        163,
        168,
        161
      ]
    },
    {
      "name": "order",
      "discriminator": [
        134,
        173,
        223,
        185,
        77,
        86,
        28,
        51
      ]
    },
    {
      "name": "userPosition",
      "discriminator": [
        251,
        248,
        209,
        245,
        83,
        234,
        17,
        27
      ]
    }
  ],
  "events": [
    {
      "name": "emergencyPauseChanged",
      "discriminator": [
        40,
        185,
        90,
        71,
        82,
        142,
        105,
        91
      ]
    },
    {
      "name": "emergencyWithdraw",
      "discriminator": [
        128,
        80,
        236,
        119,
        137,
        129,
        241,
        144
      ]
    },
    {
      "name": "feesWithdrawn",
      "discriminator": [
        234,
        15,
        0,
        119,
        148,
        241,
        40,
        21
      ]
    },
    {
      "name": "liquidityAdded",
      "discriminator": [
        154,
        26,
        221,
        108,
        238,
        64,
        217,
        161
      ]
    },
    {
      "name": "liquidityRemoved",
      "discriminator": [
        225,
        105,
        216,
        39,
        124,
        116,
        169,
        189
      ]
    },
    {
      "name": "marketCancelled",
      "discriminator": [
        139,
        163,
        33,
        168,
        19,
        180,
        81,
        170
      ]
    },
    {
      "name": "marketCreated",
      "discriminator": [
        88,
        184,
        130,
        231,
        226,
        84,
        6,
        58
      ]
    },
    {
      "name": "marketProposalProcessed",
      "discriminator": [
        80,
        17,
        251,
        0,
        216,
        18,
        207,
        60
      ]
    },
    {
      "name": "marketProposed",
      "discriminator": [
        241,
        200,
        151,
        120,
        229,
        7,
        131,
        124
      ]
    },
    {
      "name": "marketSettled",
      "discriminator": [
        237,
        212,
        22,
        175,
        201,
        117,
        215,
        99
      ]
    },
    {
      "name": "marketSettledManual",
      "discriminator": [
        190,
        239,
        153,
        183,
        91,
        104,
        213,
        11
      ]
    },
    {
      "name": "marketUpdated",
      "discriminator": [
        170,
        51,
        74,
        147,
        116,
        168,
        217,
        251
      ]
    },
    {
      "name": "positionClosed",
      "discriminator": [
        157,
        163,
        227,
        228,
        13,
        97,
        138,
        121
      ]
    },
    {
      "name": "refundClaimed",
      "discriminator": [
        136,
        64,
        242,
        99,
        4,
        244,
        208,
        130
      ]
    },
    {
      "name": "rewardsClaimed",
      "discriminator": [
        75,
        98,
        88,
        18,
        219,
        112,
        88,
        121
      ]
    },
    {
      "name": "sharesPurchased",
      "discriminator": [
        24,
        220,
        223,
        28,
        213,
        182,
        47,
        22
      ]
    },
    {
      "name": "sharesSold",
      "discriminator": [
        35,
        231,
        5,
        53,
        228,
        158,
        113,
        251
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "unauthorized",
      "msg": "Only the program admin can perform this action"
    },
    {
      "code": 6001,
      "name": "marketNotOpen",
      "msg": "Market is not open for trading"
    },
    {
      "code": 6002,
      "name": "marketExpired",
      "msg": "Market trading period has expired"
    },
    {
      "code": 6003,
      "name": "alreadySettled",
      "msg": "Market has already been settled"
    },
    {
      "code": 6004,
      "name": "tooEarlyToSettle",
      "msg": "Market cannot be settled before resolve_ts"
    },
    {
      "code": 6005,
      "name": "marketNotSettled",
      "msg": "Market has not been settled yet"
    },
    {
      "code": 6006,
      "name": "marketNotCancelled",
      "msg": "Market is not in cancelled state"
    },
    {
      "code": 6007,
      "name": "alreadyClaimed",
      "msg": "Rewards already claimed for this position"
    },
    {
      "code": 6008,
      "name": "nothingToClaim",
      "msg": "No winning tokens to claim"
    },
    {
      "code": 6009,
      "name": "staleOracle",
      "msg": "Oracle price is too stale"
    },
    {
      "code": 6010,
      "name": "invalidOracleFeed",
      "msg": "Oracle feed does not match market's configured feed"
    },
    {
      "code": 6011,
      "name": "lowOracleConfidence",
      "msg": "Oracle price confidence interval too wide"
    },
    {
      "code": 6012,
      "name": "invalidMint",
      "msg": "Provided mint does not match market's configured mint"
    },
    {
      "code": 6013,
      "name": "mathOverflow",
      "msg": "Arithmetic overflow or underflow detected"
    },
    {
      "code": 6014,
      "name": "invalidQuantity",
      "msg": "Quantity must be greater than zero and within limits"
    },
    {
      "code": 6015,
      "name": "questionTooLong",
      "msg": "Question text exceeds maximum length"
    },
    {
      "code": 6016,
      "name": "descriptionTooLong",
      "msg": "Description text exceeds maximum length"
    },
    {
      "code": 6017,
      "name": "invalidEndTime",
      "msg": "End time must be in the future"
    },
    {
      "code": 6018,
      "name": "sharePriceTooLow",
      "msg": "Share price is below the minimum allowed"
    },
    {
      "code": 6019,
      "name": "treasuryInsufficient",
      "msg": "Treasury balance insufficient for payout"
    },
    {
      "code": 6020,
      "name": "feeTooHigh",
      "msg": "Fee percentage exceeds maximum allowed (10%)"
    },
    {
      "code": 6021,
      "name": "feeAlreadyWithdrawn",
      "msg": "Protocol fee has already been withdrawn"
    },
    {
      "code": 6022,
      "name": "useOracleSettlement",
      "msg": "Price-backed markets must use settle_market with oracle price feed"
    },
    {
      "code": 6023,
      "name": "invalidOutcome",
      "msg": "Invalid outcome: must be 1 (Yes) or 2 (No)"
    },
    {
      "code": 6024,
      "name": "useManualSettlement",
      "msg": "Markets without a price feed must use settle_market_manual"
    },
    {
      "code": 6025,
      "name": "marketNotEnded",
      "msg": "Market has not ended yet"
    },
    {
      "code": 6026,
      "name": "notAWinner",
      "msg": "User did not win this market"
    },
    {
      "code": 6027,
      "name": "insufficientShares",
      "msg": "Insufficient shares to claim"
    },
    {
      "code": 6028,
      "name": "invalidMarket",
      "msg": "Invalid market ID"
    },
    {
      "code": 6029,
      "name": "cryptoMustUseOracle",
      "msg": "Crypto markets must use oracle settlement"
    },
    {
      "code": 6030,
      "name": "noFeesToWithdraw",
      "msg": "No fees to withdraw"
    },
    {
      "code": 6031,
      "name": "invalidPriceBps",
      "msg": "Limit price basis points must be between 1 and 9999"
    },
    {
      "code": 6032,
      "name": "orderAlreadyFilled",
      "msg": "Order is already filled"
    },
    {
      "code": 6033,
      "name": "orderCancelled",
      "msg": "Order is already cancelled"
    },
    {
      "code": 6034,
      "name": "selfTradingNotAllowed",
      "msg": "Cannot match trade against your own order"
    },
    {
      "code": 6035,
      "name": "endTimeTooSoon",
      "msg": "Market end time must be at least 1 hour in the future"
    },
    {
      "code": 6036,
      "name": "endTimeTooFar",
      "msg": "Market end time too far (max 1 year)"
    },
    {
      "code": 6037,
      "name": "resolveTooSoon",
      "msg": "Resolution time must be >= end time"
    },
    {
      "code": 6038,
      "name": "invalidQuestion",
      "msg": "Question must be 10-200 characters"
    },
    {
      "code": 6039,
      "name": "invalidDescription",
      "msg": "Description must be ≤ 400 characters"
    },
    {
      "code": 6040,
      "name": "emptyPool",
      "msg": "Pool is empty"
    },
    {
      "code": 6041,
      "name": "bettingClosed",
      "msg": "Betting period has ended"
    },
    {
      "code": 6042,
      "name": "insufficientFunds",
      "msg": "Insufficient funds"
    },
    {
      "code": 6043,
      "name": "alreadyInitialized",
      "msg": "Market config already initialized"
    },
    {
      "code": 6044,
      "name": "nothingToRefund",
      "msg": "Nothing to refund"
    },
    {
      "code": 6045,
      "name": "noWinningTokens",
      "msg": "No winning tokens to claim"
    },
    {
      "code": 6046,
      "name": "outcomeNotSet",
      "msg": "Outcome not set"
    },
    {
      "code": 6047,
      "name": "zeroSupply",
      "msg": "Zero winning supply"
    },
    {
      "code": 6048,
      "name": "zeroPayout",
      "msg": "Zero payout calculated"
    },
    {
      "code": 6049,
      "name": "oracleFeedMismatch",
      "msg": "Pyth price feed ID mismatch"
    },
    {
      "code": 6050,
      "name": "stalePrice",
      "msg": "Pyth price is stale (older than 60 seconds)"
    },
    {
      "code": 6051,
      "name": "usePythForCrypto",
      "msg": "Use Pyth oracle to settle Crypto markets"
    },
    {
      "code": 6052,
      "name": "marketPaused",
      "msg": "Market is paused for maintenance"
    },
    {
      "code": 6053,
      "name": "reentrancyDetected",
      "msg": "Reentrancy detected — call rejected"
    },
    {
      "code": 6054,
      "name": "insufficientLiquidity",
      "msg": "Not enough liquidity in pool"
    },
    {
      "code": 6055,
      "name": "liquidityPositionNotFound",
      "msg": "Liquidity position not found"
    },
    {
      "code": 6056,
      "name": "noLpTokens",
      "msg": "No LP tokens to withdraw"
    },
    {
      "code": 6057,
      "name": "slippageExceeded",
      "msg": "Slippage tolerance exceeded"
    },
    {
      "code": 6058,
      "name": "minSpendNotMet",
      "msg": "Minimum spend not met"
    },
    {
      "code": 6059,
      "name": "signatureVerificationFailed",
      "msg": "Signature verification failed"
    },
    {
      "code": 6060,
      "name": "alreadyCancelled",
      "msg": "Market already cancelled"
    },
    {
      "code": 6061,
      "name": "invalidCategory",
      "msg": "Invalid category"
    },
    {
      "code": 6062,
      "name": "alreadyPaused",
      "msg": "Emergency pause is already active"
    },
    {
      "code": 6063,
      "name": "notPaused",
      "msg": "Emergency pause is not active"
    },
    {
      "code": 6064,
      "name": "emergencyPaused",
      "msg": "Trading is halted — the market is under an emergency pause"
    },
    {
      "code": 6065,
      "name": "multisigRequired",
      "msg": "Admin operation requires multisig approval"
    },
    {
      "code": 6066,
      "name": "resolutionSourceMismatch",
      "msg": "Market resolution source mismatch"
    },
    {
      "code": 6067,
      "name": "batchSizeExceeded",
      "msg": "Batch size exceeds maximum"
    },
    {
      "code": 6068,
      "name": "proposalNotPending",
      "msg": "Proposal is not in Pending state"
    },
    {
      "code": 6069,
      "name": "proposalBondTooLow",
      "msg": "Proposal bond is below the minimum required"
    },
    {
      "code": 6070,
      "name": "invalidGuardian",
      "msg": "Guardian pubkey is invalid (cannot be the zero address)"
    },
    {
      "code": 6071,
      "name": "guardianAlreadyExists",
      "msg": "Guardian is already registered"
    },
    {
      "code": 6072,
      "name": "maxGuardiansReached",
      "msg": "Maximum number of guardians reached (3)"
    },
    {
      "code": 6073,
      "name": "guardianNotFound",
      "msg": "Guardian not found in the set"
    },
    {
      "code": 6074,
      "name": "invalidThreshold",
      "msg": "Threshold must be between 1 and the number of registered guardians"
    },
    {
      "code": 6075,
      "name": "thresholdExceedsGuardians",
      "msg": "Cannot remove guardian: required confirmations exceed remaining guardians"
    }
  ],
  "types": [
    {
      "name": "category",
      "docs": [
        "Market category for frontend filtering."
      ],
      "repr": {
        "kind": "rust"
      },
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "crypto"
          },
          {
            "name": "sports"
          },
          {
            "name": "politics"
          },
          {
            "name": "tech"
          },
          {
            "name": "other"
          }
        ]
      }
    },
    {
      "name": "comparison",
      "docs": [
        "Price comparison direction for settlement."
      ],
      "repr": {
        "kind": "rust"
      },
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "greaterThan"
          },
          {
            "name": "lessThan"
          }
        ]
      }
    },
    {
      "name": "config",
      "docs": [
        "Config PDA — singleton account storing program-wide configuration.",
        "Seeds: [\"config\"]",
        "Created once by `initialize_config`. Anchor's `init` constraint",
        "naturally rejects a second call (account already exists)."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "admin",
            "docs": [
              "The admin pubkey — only this key can create/settle/cancel markets",
              "and withdraw fees."
            ],
            "type": "pubkey"
          },
          {
            "name": "feeBps",
            "docs": [
              "Protocol fee in basis points (e.g. 200 = 2%), validated ≤ 1000 (10%).",
              "Taken from the losing pool only at settlement time."
            ],
            "type": "u16"
          },
          {
            "name": "marketCount",
            "docs": [
              "Auto-incrementing market counter, used as each market's unique id.",
              "Also used as part of the Market PDA seed."
            ],
            "type": "u64"
          },
          {
            "name": "bump",
            "docs": [
              "PDA canonical bump, stored on-chain for efficient re-derivation."
            ],
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "emergencyPause",
      "docs": [
        "Emergency pause state — singleton account.",
        "When paused, all non-admin trading is halted."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "paused",
            "docs": [
              "Whether the program is paused"
            ],
            "type": "bool"
          },
          {
            "name": "pausedBy",
            "docs": [
              "Admin who paused (for audit trail)"
            ],
            "type": "pubkey"
          },
          {
            "name": "pausedAt",
            "docs": [
              "Timestamp of pause"
            ],
            "type": "i64"
          },
          {
            "name": "guardians",
            "docs": [
              "Multisig addresses that can unpause"
            ],
            "type": {
              "array": [
                "pubkey",
                3
              ]
            }
          },
          {
            "name": "requiredConfirmations",
            "docs": [
              "Number of guardian confirmations required to unpause"
            ],
            "type": "u8"
          },
          {
            "name": "confirmations",
            "docs": [
              "Current guardian confirmations count"
            ],
            "type": "u8"
          },
          {
            "name": "bump",
            "docs": [
              "PDA bump"
            ],
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "emergencyPauseChanged",
      "docs": [
        "Emitted when program is paused or unpaused."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "paused",
            "type": "bool"
          },
          {
            "name": "pausedBy",
            "type": "pubkey"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "emergencyWithdraw",
      "docs": [
        "Emitted when admin performs emergency withdrawal."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "marketId",
            "type": "u64"
          },
          {
            "name": "admin",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "reason",
            "type": "string"
          }
        ]
      }
    },
    {
      "name": "feesWithdrawn",
      "docs": [
        "Emitted when the admin withdraws collected fees."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "marketId",
            "type": "u64"
          },
          {
            "name": "amount",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "liquidityAdded",
      "docs": [
        "Emitted when liquidity is added via `add_liquidity`."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "marketId",
            "type": "u64"
          },
          {
            "name": "provider",
            "type": "pubkey"
          },
          {
            "name": "yesLamports",
            "type": "u64"
          },
          {
            "name": "noLamports",
            "type": "u64"
          },
          {
            "name": "lpTokensMinted",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "liquidityPosition",
      "docs": [
        "Liquidity Provider position for a single market.",
        "Tracks how much liquidity an LP has deposited."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "docs": [
              "LP wallet address"
            ],
            "type": "pubkey"
          },
          {
            "name": "market",
            "docs": [
              "Market this LP position belongs to"
            ],
            "type": "pubkey"
          },
          {
            "name": "lpTokens",
            "docs": [
              "Amount of LP tokens minted (representing share of the pool)"
            ],
            "type": "u64"
          },
          {
            "name": "yesDeposited",
            "docs": [
              "Total YES tokens deposited"
            ],
            "type": "u64"
          },
          {
            "name": "noDeposited",
            "docs": [
              "Total NO tokens deposited"
            ],
            "type": "u64"
          },
          {
            "name": "totalLamportsDeposited",
            "docs": [
              "Total lamports deposited as liquidity"
            ],
            "type": "u64"
          },
          {
            "name": "createdAt",
            "docs": [
              "Unix timestamp when position was created"
            ],
            "type": "i64"
          },
          {
            "name": "updatedAt",
            "docs": [
              "Unix timestamp of last liquidity modification"
            ],
            "type": "i64"
          },
          {
            "name": "bump",
            "docs": [
              "PDA bump"
            ],
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "liquidityRemoved",
      "docs": [
        "Emitted when liquidity is removed via `remove_liquidity`."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "marketId",
            "type": "u64"
          },
          {
            "name": "provider",
            "type": "pubkey"
          },
          {
            "name": "yesPayout",
            "type": "u64"
          },
          {
            "name": "noPayout",
            "type": "u64"
          },
          {
            "name": "lpTokensBurned",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "market",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "marketId",
            "docs": [
              "Unique market identifier (auto-incremented from Config.market_count)."
            ],
            "type": "u64"
          },
          {
            "name": "authority",
            "docs": [
              "Market creator (== config.admin for MVP)."
            ],
            "type": "pubkey"
          },
          {
            "name": "question",
            "docs": [
              "The prediction question (e.g. \"Will SOL close above $250...?\").",
              "Max 200 characters."
            ],
            "type": "string"
          },
          {
            "name": "description",
            "docs": [
              "Settlement rules / description text. Max 400 characters."
            ],
            "type": "string"
          },
          {
            "name": "category",
            "docs": [
              "Market category for frontend filtering."
            ],
            "type": {
              "defined": {
                "name": "category"
              }
            }
          },
          {
            "name": "oracleFeedId",
            "docs": [
              "Pyth oracle feed id for the asset this market tracks.",
              "Verified at settlement time against the passed-in price account."
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "targetPrice",
            "docs": [
              "Target price for settlement comparison (in Pyth's fixed-point format)."
            ],
            "type": "i64"
          },
          {
            "name": "targetExpo",
            "docs": [
              "Target price exponent (matches Pyth's exponent representation)."
            ],
            "type": "i32"
          },
          {
            "name": "comparison",
            "docs": [
              "How to compare oracle price vs target: GreaterThan or LessThan."
            ],
            "type": {
              "defined": {
                "name": "comparison"
              }
            }
          },
          {
            "name": "endTs",
            "docs": [
              "Unix timestamp when trading stops (no more buys accepted after this)."
            ],
            "type": "i64"
          },
          {
            "name": "resolveTs",
            "docs": [
              "Earliest unix timestamp when settlement is allowed (>= end_ts)."
            ],
            "type": "i64"
          },
          {
            "name": "status",
            "docs": [
              "Current lifecycle status: Open, Settled, or Cancelled."
            ],
            "type": {
              "defined": {
                "name": "marketStatus"
              }
            }
          },
          {
            "name": "winningOutcome",
            "docs": [
              "Winner after settlement: Unset, Yes, or No."
            ],
            "type": {
              "defined": {
                "name": "winningOutcome"
              }
            }
          },
          {
            "name": "yesMint",
            "docs": [
              "Pubkey of the YES SPL token mint (PDA-derived)."
            ],
            "type": "pubkey"
          },
          {
            "name": "noMint",
            "docs": [
              "Pubkey of the NO SPL token mint (PDA-derived)."
            ],
            "type": "pubkey"
          },
          {
            "name": "yesPoolLamports",
            "docs": [
              "Total lamports deposited by YES-side buyers."
            ],
            "type": "u64"
          },
          {
            "name": "noPoolLamports",
            "docs": [
              "Total lamports deposited by NO-side buyers."
            ],
            "type": "u64"
          },
          {
            "name": "yesSupply",
            "docs": [
              "Total YES tokens minted (in base units, i.e. shares * 10^6)."
            ],
            "type": "u64"
          },
          {
            "name": "noSupply",
            "docs": [
              "Total NO tokens minted (in base units)."
            ],
            "type": "u64"
          },
          {
            "name": "totalPayoutPool",
            "docs": [
              "Computed at settlement: total_pool - fee. This is the pot winners split."
            ],
            "type": "u64"
          },
          {
            "name": "feeCollected",
            "docs": [
              "Fee collected at settlement (from losing pool only)."
            ],
            "type": "u64"
          },
          {
            "name": "feeWithdrawn",
            "docs": [
              "Double-withdraw guard for admin fee withdrawal."
            ],
            "type": "bool"
          },
          {
            "name": "totalClaimed",
            "docs": [
              "Total lamports already claimed by winners (prevents treasury over-drain)."
            ],
            "type": "u64"
          },
          {
            "name": "settledPrice",
            "docs": [
              "Oracle price used for settlement (stored for transparency/auditability)."
            ],
            "type": "i64"
          },
          {
            "name": "settledExpo",
            "docs": [
              "Oracle exponent at settlement time."
            ],
            "type": "i32"
          },
          {
            "name": "settledAt",
            "docs": [
              "Timestamp of settlement."
            ],
            "type": "i64"
          },
          {
            "name": "sharePriceLamports",
            "docs": [
              "Fixed price per share in lamports (set at market creation)."
            ],
            "type": "u64"
          },
          {
            "name": "bump",
            "docs": [
              "Market PDA canonical bump."
            ],
            "type": "u8"
          },
          {
            "name": "treasuryBump",
            "docs": [
              "Treasury PDA canonical bump (stored here for efficient claim/refund CPIs)."
            ],
            "type": "u8"
          },
          {
            "name": "feeBps",
            "docs": [
              "Fee in basis points (e.g. 30 = 0.3%). Charged from the losing pool at settlement."
            ],
            "type": "u16"
          },
          {
            "name": "reentrancyLock",
            "docs": [
              "Reentrancy protection lock."
            ],
            "type": {
              "defined": {
                "name": "reentrancyLock"
              }
            }
          }
        ]
      }
    },
    {
      "name": "marketCancelled",
      "docs": [
        "Emitted when a market is cancelled via `cancel_market`."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "marketId",
            "type": "u64"
          },
          {
            "name": "cancelledBy",
            "type": "pubkey"
          },
          {
            "name": "reason",
            "type": "string"
          }
        ]
      }
    },
    {
      "name": "marketCreated",
      "docs": [
        "Emitted when a new market is created via `initialize_market`.",
        "Frontend subscribes for live \"new market\" toasts and grid updates."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "marketId",
            "type": "u64"
          },
          {
            "name": "question",
            "type": "string"
          },
          {
            "name": "endTs",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "marketProposal",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "proposalId",
            "type": "u64"
          },
          {
            "name": "proposer",
            "type": "pubkey"
          },
          {
            "name": "question",
            "type": "string"
          },
          {
            "name": "description",
            "type": "string"
          },
          {
            "name": "category",
            "type": "u8"
          },
          {
            "name": "oracleFeedId",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "targetPrice",
            "type": "i64"
          },
          {
            "name": "targetExpo",
            "type": "i32"
          },
          {
            "name": "comparison",
            "type": "u8"
          },
          {
            "name": "endTs",
            "type": "i64"
          },
          {
            "name": "resolveTs",
            "type": "i64"
          },
          {
            "name": "sharePriceLamports",
            "type": "u64"
          },
          {
            "name": "bondLamports",
            "type": "u64"
          },
          {
            "name": "status",
            "type": {
              "defined": {
                "name": "proposalStatus"
              }
            }
          },
          {
            "name": "createdAt",
            "type": "i64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "marketProposalProcessed",
      "docs": [
        "Emitted when a market proposal is approved (or rejected) by the admin."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "proposalId",
            "type": "u64"
          },
          {
            "name": "proposer",
            "type": "pubkey"
          },
          {
            "name": "status",
            "type": "u8"
          },
          {
            "name": "marketId",
            "type": {
              "option": "u64"
            }
          }
        ]
      }
    },
    {
      "name": "marketProposed",
      "docs": [
        "Emitted when a user proposes a new market."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "proposalId",
            "type": "u64"
          },
          {
            "name": "proposer",
            "type": "pubkey"
          },
          {
            "name": "question",
            "type": "string"
          },
          {
            "name": "bondLamports",
            "type": "u64"
          },
          {
            "name": "createdAt",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "marketSettled",
      "docs": [
        "Emitted when a market is settled via `settle_market` (Pyth oracle)."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "marketId",
            "type": "u64"
          },
          {
            "name": "winningOutcome",
            "type": "u8"
          },
          {
            "name": "settledPrice",
            "type": "i64"
          },
          {
            "name": "totalPayoutPool",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "marketSettledManual",
      "docs": [
        "Emitted when a market is settled manually (non-crypto markets)."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "marketId",
            "type": "u64"
          },
          {
            "name": "winningOutcome",
            "type": "u8"
          },
          {
            "name": "feeCollected",
            "type": "u64"
          },
          {
            "name": "totalPayoutPool",
            "type": "u64"
          },
          {
            "name": "settledBy",
            "type": "pubkey"
          },
          {
            "name": "settledAt",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "marketStatus",
      "docs": [
        "Market lifecycle status."
      ],
      "repr": {
        "kind": "rust"
      },
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "open"
          },
          {
            "name": "settled"
          },
          {
            "name": "cancelled"
          }
        ]
      }
    },
    {
      "name": "marketUpdated",
      "docs": [
        "Emitted when market details are updated via `update_market`."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "marketId",
            "type": "u64"
          },
          {
            "name": "question",
            "type": "string"
          },
          {
            "name": "endTs",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "order",
      "docs": [
        "Order PDA — represents an on-chain limit order (Bid or Ask) for a market.",
        "Seeds: [\"order\", market.key(), maker.key(), order_id.to_le_bytes()]"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "market",
            "docs": [
              "Market account this order belongs to."
            ],
            "type": "pubkey"
          },
          {
            "name": "maker",
            "docs": [
              "Order maker address."
            ],
            "type": "pubkey"
          },
          {
            "name": "orderId",
            "docs": [
              "Unique order ID per user."
            ],
            "type": "u64"
          },
          {
            "name": "side",
            "docs": [
              "Outcome side: YES or NO."
            ],
            "type": {
              "defined": {
                "name": "side"
              }
            }
          },
          {
            "name": "isBuy",
            "docs": [
              "Order side: true = Buy (Bid), false = Sell (Ask)."
            ],
            "type": "bool"
          },
          {
            "name": "priceBps",
            "docs": [
              "Limit price in basis points (1 to 9999 representing 0.0001 to 0.9999 SOL per share)."
            ],
            "type": "u64"
          },
          {
            "name": "quantity",
            "docs": [
              "Total quantity of shares in base units (shares * 10^6)."
            ],
            "type": "u64"
          },
          {
            "name": "filledQuantity",
            "docs": [
              "Quantity already filled."
            ],
            "type": "u64"
          },
          {
            "name": "status",
            "docs": [
              "Current order status."
            ],
            "type": {
              "defined": {
                "name": "orderStatus"
              }
            }
          },
          {
            "name": "bump",
            "docs": [
              "Order PDA canonical bump."
            ],
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "orderStatus",
      "repr": {
        "kind": "rust"
      },
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "open"
          },
          {
            "name": "filled"
          },
          {
            "name": "cancelled"
          }
        ]
      }
    },
    {
      "name": "positionClosed",
      "docs": [
        "Emitted when a user closes their position account to reclaim rent."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "marketId",
            "type": "u64"
          },
          {
            "name": "user",
            "type": "pubkey"
          },
          {
            "name": "rentReclaimed",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "proposalStatus",
      "repr": {
        "kind": "rust"
      },
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "pending"
          },
          {
            "name": "approved"
          },
          {
            "name": "rejected"
          }
        ]
      }
    },
    {
      "name": "reentrancyLock",
      "docs": [
        "Reentrancy guard stored in accounts.",
        "Use explicit acquire/release within a scope block to avoid",
        "Rust borrow checker conflicts with mutable account access."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "locked",
            "type": "u8"
          },
          {
            "name": "locker",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "refundClaimed",
      "docs": [
        "Emitted when a user claims a refund on a cancelled market."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "marketId",
            "type": "u64"
          },
          {
            "name": "user",
            "type": "pubkey"
          },
          {
            "name": "refund",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "rewardsClaimed",
      "docs": [
        "Emitted when a winner claims their rewards via `claim_rewards`."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "marketId",
            "type": "u64"
          },
          {
            "name": "claimer",
            "type": "pubkey"
          },
          {
            "name": "payout",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "sharesPurchased",
      "docs": [
        "Emitted when shares are purchased via `buy_shares`.",
        "Powers the live activity feed and real-time probability bar updates."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "marketId",
            "type": "u64"
          },
          {
            "name": "buyer",
            "type": "pubkey"
          },
          {
            "name": "side",
            "type": {
              "defined": {
                "name": "side"
              }
            }
          },
          {
            "name": "quantity",
            "type": "u64"
          },
          {
            "name": "cost",
            "type": "u64"
          },
          {
            "name": "newYesPool",
            "type": "u64"
          },
          {
            "name": "newNoPool",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "sharesSold",
      "docs": [
        "Emitted when a user sells shares back to the pool before expiry."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "marketId",
            "type": "u64"
          },
          {
            "name": "seller",
            "type": "pubkey"
          },
          {
            "name": "side",
            "type": {
              "defined": {
                "name": "side"
              }
            }
          },
          {
            "name": "quantity",
            "type": "u64"
          },
          {
            "name": "refund",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "side",
      "docs": [
        "Side for buy_shares instruction — YES or NO."
      ],
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "yes"
          },
          {
            "name": "no"
          }
        ]
      }
    },
    {
      "name": "userPosition",
      "docs": [
        "UserPosition PDA — one per user per market.",
        "Seeds: [\"position\", market_pubkey, user_pubkey]",
        "",
        "Token balances in the user's ATAs are the source of truth for claim",
        "amounts; this PDA is a portfolio-page index AND the double-claim guard."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "docs": [
              "Owner of this position."
            ],
            "type": "pubkey"
          },
          {
            "name": "market",
            "docs": [
              "Market this position belongs to."
            ],
            "type": "pubkey"
          },
          {
            "name": "yesAmount",
            "docs": [
              "Number of YES shares purchased (in base units, i.e. shares * 10^6)."
            ],
            "type": "u64"
          },
          {
            "name": "noAmount",
            "docs": [
              "Number of NO shares purchased (in base units)."
            ],
            "type": "u64"
          },
          {
            "name": "claimed",
            "docs": [
              "Whether rewards/refund have been claimed. Double-claim guard."
            ],
            "type": "bool"
          },
          {
            "name": "totalSpentLamports",
            "docs": [
              "Total lamports spent across all purchases in this market.",
              "Used for portfolio P&L display on the frontend."
            ],
            "type": "u64"
          },
          {
            "name": "bump",
            "docs": [
              "PDA canonical bump."
            ],
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "winningOutcome",
      "docs": [
        "Winning outcome after settlement."
      ],
      "repr": {
        "kind": "rust"
      },
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "unset"
          },
          {
            "name": "yes"
          },
          {
            "name": "no"
          }
        ]
      }
    }
  ],
  "constants": [
    {
      "name": "configSeed",
      "type": "bytes",
      "value": "[99, 111, 110, 102, 105, 103]"
    },
    {
      "name": "lpSeed",
      "type": "bytes",
      "value": "[108, 112]"
    },
    {
      "name": "marketSeed",
      "type": "bytes",
      "value": "[109, 97, 114, 107, 101, 116]"
    },
    {
      "name": "noMintSeed",
      "type": "bytes",
      "value": "[110, 111, 95, 109, 105, 110, 116]"
    },
    {
      "name": "orderSeed",
      "type": "bytes",
      "value": "[111, 114, 100, 101, 114]"
    },
    {
      "name": "pauseSeed",
      "type": "bytes",
      "value": "[101, 109, 101, 114, 103, 101, 110, 99, 121, 95, 112, 97, 117, 115, 101]"
    },
    {
      "name": "positionSeed",
      "type": "bytes",
      "value": "[112, 111, 115, 105, 116, 105, 111, 110]"
    },
    {
      "name": "proposalSeed",
      "type": "bytes",
      "value": "[112, 114, 111, 112, 111, 115, 97, 108]"
    },
    {
      "name": "proposalVaultSeed",
      "type": "bytes",
      "value": "[112, 114, 111, 112, 111, 115, 97, 108, 95, 118, 97, 117, 108, 116]"
    },
    {
      "name": "treasurySeed",
      "type": "bytes",
      "value": "[116, 114, 101, 97, 115, 117, 114, 121]"
    },
    {
      "name": "yesMintSeed",
      "type": "bytes",
      "value": "[121, 101, 115, 95, 109, 105, 110, 116]"
    }
  ]
};
