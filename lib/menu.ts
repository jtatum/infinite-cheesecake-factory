export type Dish = {
  id: string;
  name: string;
  description: string;
  price: string;
  category: string;
  warning: string;
  emoji: string;
  ingredients: string[];
  imagePrompt: string;
  source: {
    title: string;
    url: string;
  };
  secondarySource?: {
    title: string;
    url: string;
  };
};

export type Topic = {
  title: string;
  extract?: string;
  url?: string;
  family?: string;
};
