// Lesson "Metamorphic and property-based testing": relations instead of labels.
//
//   MODEL_PROVIDER=mock node metamorphic.mjs
import { callModel } from "./model.mjs";

const TASK = "Classify the review as positive, negative or neutral. Reply with one word.\n\nReview: {input}";

// name -> [transformation, whether the label must stay "same" or become "different"]
const RELATIONS = {
  addIrrelevantContext: [(t) => `${t} The parking lot is on 5th Street.`, "same"],
  shout: [(t) => t.toUpperCase(), "same"],
  negate: [(t) => t.replace(" was ", " was not "), "different"],
};

const classify = async (text) => (await callModel(TASK.replace("{input}", text))).trim().toLowerCase().replace(/\.$/, "");

export async function checkRelations(sources) {
  const violations = [];
  for (const text of sources) {
    const base = await classify(text);
    for (const [name, [transform, expect]] of Object.entries(RELATIONS)) {
      const follow = await classify(transform(text));
      if ((expect === "same") !== (follow === base)) violations.push({ name, text, base, follow });
    }
  }
  return violations;
}

const sources = ["The food was great.", "The service was slow and rude."];
const found = await checkRelations(sources);
const total = sources.length * Object.keys(RELATIONS).length;
console.log(`${total - found.length}/${total} relations held`);
for (const v of found) console.log(`  VIOLATION ${v.name}: ${JSON.stringify(v.text)}: ${v.base} -> ${v.follow}`);
