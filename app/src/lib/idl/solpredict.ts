/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/solpredict.json`.
 */
export type Solpredict = {
  "address": "FNLixfQFTWZNFd9YuPk4c6VwcUs4nC2Z7FzhJkhHL9eD",
  "metadata": {
    "name": "solpredict",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "SOLPredict — Decentralized Prediction Market on Solana"
  },
  "instructions": [
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
          "docs": [
            "Admin signer — must match `config.admin`."
          ],
          "signer": true
        },
        {
          "name": "config",
          "docs": [
            "Config PDA — to verify admin identity."
          ],
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
            "Market PDA — must be Open (can't cancel something already settled)."
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
            "UserPosition PDA — double-refund guard."
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
          "docs": [
            "Claimer — must own the position and tokens."
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "market",
          "docs": [
            "Market — must be Settled."
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
            "Treasury PDA — pays out SOL to winners."
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
          "name": "winningMint",
          "docs": [
            "Winning mint — YES or NO depending on market.winning_outcome."
          ],
          "writable": true
        },
        {
          "name": "claimerAta",
          "docs": [
            "Claimer's ATA for the winning mint."
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
          "docs": [
            "UserPosition PDA — double-claim guard."
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
          "name": "market",
          "docs": [
            "Permissionless — anyone can trigger settlement for oracle markets.",
            "No admin required."
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
          "name": "config",
          "docs": [
            "Config PDA — read-only for fee calculation."
          ],
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
            "Pyth PriceUpdateV2 account — posted just before this instruction",
            "in the same transaction bundle.",
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
          "docs": [
            "Admin signer — must match `config.admin`."
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "config",
          "docs": [
            "Config PDA — to verify admin identity."
          ],
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
            "Market — must be Settled, fee not yet withdrawn."
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
            "Treasury PDA — fee source."
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
      "name": "mathOverflow",
      "msg": "Arithmetic overflow or underflow detected"
    },
    {
      "code": 6013,
      "name": "invalidQuantity",
      "msg": "Quantity must be greater than zero and within limits"
    },
    {
      "code": 6014,
      "name": "questionTooLong",
      "msg": "Question text exceeds maximum length"
    },
    {
      "code": 6015,
      "name": "descriptionTooLong",
      "msg": "Description text exceeds maximum length"
    },
    {
      "code": 6016,
      "name": "invalidEndTime",
      "msg": "End time must be in the future"
    },
    {
      "code": 6017,
      "name": "sharePriceTooLow",
      "msg": "Share price is below the minimum allowed"
    },
    {
      "code": 6018,
      "name": "treasuryInsufficient",
      "msg": "Treasury balance insufficient for payout"
    },
    {
      "code": 6019,
      "name": "feeTooHigh",
      "msg": "Fee percentage exceeds maximum allowed (10%)"
    },
    {
      "code": 6020,
      "name": "feeAlreadyWithdrawn",
      "msg": "Protocol fee has already been withdrawn"
    },
    {
      "code": 6021,
      "name": "useOracleSettlement",
      "msg": "Price-backed markets must use settle_market with oracle price feed"
    },
    {
      "code": 6022,
      "name": "invalidOutcome",
      "msg": "Invalid outcome: must be 1 (Yes) or 2 (No)"
    },
    {
      "code": 6023,
      "name": "useManualSettlement",
      "msg": "Markets without a price feed must use settle_market_manual"
    },
    {
      "code": 6024,
      "name": "marketNotEnded",
      "msg": "Market has not ended yet"
    },
    {
      "code": 6025,
      "name": "notAWinner",
      "msg": "User did not win this market"
    },
    {
      "code": 6026,
      "name": "insufficientShares",
      "msg": "Insufficient shares to claim"
    },
    {
      "code": 6027,
      "name": "invalidMarket",
      "msg": "Invalid market ID"
    },
    {
      "code": 6028,
      "name": "cryptoMustUseOracle",
      "msg": "Crypto markets must use oracle settlement"
    },
    {
      "code": 6029,
      "name": "noFeesToWithdraw",
      "msg": "No fees to withdraw"
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
      "name": "marketSettled",
      "docs": [
        "Emitted when a market is settled via `settle_market`."
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
      "name": "positionSeed",
      "type": "bytes",
      "value": "[112, 111, 115, 105, 116, 105, 111, 110]"
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
