const anchor = require("@coral-xyz/anchor");
const idl = require("./src/lib/idl/solpredict.json");

async function main() {
  const connection = new anchor.web3.Connection("http://127.0.0.1:8899", "confirmed");
  const provider = new anchor.AnchorProvider(connection, {}, {});
  const program = new anchor.Program(idl, provider);
  const [configPda] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("config")],
    program.programId
  );
  try {
    const configAcc = await program.account.config.fetch(configPda);
    console.log("Config PDA Address:", configPda.toBase58());
    console.log("Admin Address:", configAcc.admin.toBase58());
    console.log("Market Count:", configAcc.marketCount.toString());
    console.log("Fee Bps:", configAcc.feeBps.toString());
  } catch (e) {
    console.log("CONFIG_NOT_FOUND");
  }
}
main();
