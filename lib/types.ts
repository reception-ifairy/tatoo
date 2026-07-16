export type DataSource = "sql" | "json";

export interface Category {
  id: string;
  name: string;
  description: string;
}

export interface ReferenceItem {
  id: string;
  name: string;
}

export interface TattooStyle {
  id: string;
  name: string;
  categoryId: string;
  categoryName: string;
  description: string;
  history: string;
  distinctFeatures: string;
  narrativeDescription: string;
  motifs: string[];
  techniques: ReferenceItem[];
  relatedStyles: ReferenceItem[];
}

export interface TattooTechnique {
  id: string;
  name: string;
  categoryId: string;
  categoryName: string;
  description: string;
  difficulty: string;
  narrativeDescription: string;
  usedInStyles: ReferenceItem[];
}

export interface MixedStyle {
  id: string;
  name: string;
  description: string;
  narrativeDescription: string;
  components: ReferenceItem[];
}

export interface CompendiumData {
  source: DataSource;
  version: string;
  updatedAt: string;
  categories: Category[];
  techniqueCategories: Category[];
  styles: TattooStyle[];
  techniques: TattooTechnique[];
  mixedStyles: MixedStyle[];
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AlexeiRuntime {
  persona: Record<string, unknown>;
  knowledgeBase: Record<string, unknown>;
  systemPrompt: string;
  imagePromptTemplate: string;
  source: DataSource;
}
