export interface FeatureVector {
  lengthScore: number;
  isWord: number;
  luckyScore: number;
  memeScore: number;
  repeatingScore: number;
  pronounceability: number;
  isPalindrome: number;
  isSequential: number;
  allDigits: number;
}

export interface PriceResult {
  handle: string;
  price: number;
  features: FeatureVector;
  breakdown: FeatureBreakdown[];
}

export interface FeatureBreakdown {
  name: string;
  value: number;
  weight: number;
  contribution: number;
}

export interface HandleRecord {
  handle: string;
  owner_agent_id: string;
  price_paid: number;
  listed_price: number | null;
  registered_at: string;
  status: 'active' | 'listed' | 'transferred';
}

export interface TransactionRecord {
  id: number;
  handle: string;
  from_agent: string | null;
  to_agent: string;
  price: number;
  proposal_id: string | null;
  type: 'purchase' | 'resale' | 'transfer';
  timestamp: string;
}

export interface Weights {
  layer1: {
    length: number;
    word: number;
    lucky: number;
    meme: number;
    repeat: number;
    pronounce: number;
    palindrome: number;
    sequential: number;
    digits: number;
  };
  layer2: {
    shortWord: number;
    digitLucky: number;
    repeatLucky: number;
    shortDigit: number;
    memePalindrome: number;
  };
  basePrice: number;
  maxPrice: number;
  scale: number;
}

export interface CommandResult {
  reply: string;
  announce?: string;
}

export interface PendingBuy {
  handle: string;
  price: number;
  agentId: string;
  expiresAt: number;
}
