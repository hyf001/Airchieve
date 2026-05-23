import type { CharacterSummary } from "@/entities/asset";

const CHARACTER_CREATION_REFERENCE_KEY = "airchieve.character.creationReference";

export interface CharacterCreationReference {
  id: number;
  name: string;
}

export const storeCharacterCreationReference = (character: Pick<CharacterSummary, "id" | "name">) => {
  window.sessionStorage.setItem(
    CHARACTER_CREATION_REFERENCE_KEY,
    JSON.stringify({
      id: character.id,
      name: character.name,
    }),
  );
};

export const readCharacterCreationReference = (): CharacterCreationReference | null => {
  const rawValue = window.sessionStorage.getItem(CHARACTER_CREATION_REFERENCE_KEY);
  if (!rawValue) return null;

  try {
    const parsed = JSON.parse(rawValue) as Partial<CharacterCreationReference>;
    if (typeof parsed.id === "number" && Number.isInteger(parsed.id) && parsed.id > 0 && typeof parsed.name === "string") {
      return { id: parsed.id, name: parsed.name };
    }
  } catch {
    window.sessionStorage.removeItem(CHARACTER_CREATION_REFERENCE_KEY);
  }

  return null;
};

export const clearCharacterCreationReference = () => {
  window.sessionStorage.removeItem(CHARACTER_CREATION_REFERENCE_KEY);
};
