import type { Metadata } from "next";
import { Connection, PublicKey } from "@solana/web3.js";

const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com";
const PROGRAM_ID = process.env.NEXT_PUBLIC_PROGRAM_ID || "9YukHcQVqnST4SNpnLrdTBHDQU63Lrn93zu6Et3Ubaez";

interface Props {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}

async function parseMarketQuestion(marketPda: PublicKey): Promise<string | null> {
  try {
    const connection = new Connection(RPC_URL);
    const accountInfo = await connection.getAccountInfo(marketPda);
    if (!accountInfo) return null;

    const data = accountInfo.data;
    // Borsh layout: 8(disc) + 8(market_id u64 LE) + 32(authority pubkey)
    const qLenOffset = 8 + 8 + 32;
    const qLen = data.readUInt32LE(qLenOffset);
    const question = data.toString("utf8", qLenOffset + 4, qLenOffset + 4 + qLen);
    return question;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  try {
    const { id } = await params;
    const marketPda = new PublicKey(id);
    const question = await parseMarketQuestion(marketPda);

    if (question) {
      const title = `${question} — SOLPredict`;
      const description = `Trade YES/NO on SOLPredict. Fully on-chain prediction market settled by Pyth oracles on Solana Devnet.`;

      return {
        title,
        description,
        openGraph: {
          title,
          description,
          type: "website",
          siteName: "SOLPredict",
          images: [
            {
              url: "/icon.png",
              width: 1024,
              height: 1024,
              alt: question,
            },
          ],
        },
        twitter: {
          card: "summary_large_image",
          title,
          description,
          images: ["/icon.png"],
        },
      };
    }
  } catch {
    // Fall through to default metadata
  }

  return {
    title: "Market — SOLPredict",
    description: "Decentralized prediction market on Solana Devnet.",
  };
}

export default function MarketLayout({ children, params }: Props) {
  return children;
}
