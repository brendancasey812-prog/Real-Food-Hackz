import { FOOD_CATEGORIES } from "./foodcat";
import type { FoodCategory, Location } from "./types";

/**
 * Working out what a food *is* from its name.
 *
 * The receipt scanner only reports four coarse buckets (Protein / Fruit /
 * Veggie / Pantry), so anything it can't place lands in "Pantry" and used to
 * arrive as a condiment — shallots filed next to the ketchup. This is the
 * second pass: a keyword read of the name that puts the food on the right shelf
 * and in the right room, and that the app can re-run over foods it filed badly
 * before.
 *
 * It is deliberately conservative. No match means no opinion, and the caller
 * keeps whatever it had — a wrong guess is worse than a coarse one.
 */

export interface FoodPlacement {
  category: FoodCategory;
  location: Location;
}

/**
 * Rules are checked in order, so the specific ones come first: "garlic powder"
 * has to be read as a spice before "garlic" makes it a vegetable, and "coconut
 * milk" as dairy before "coconut" makes it a nut.
 */
const RULES: { category: FoodCategory; location: Location; words: string[] }[] = [
  // --- Spices & herbs (before produce: powders beat the fresh thing) ---
  {
    category: "spice", location: "pantry",
    words: [
      "garlic powder", "onion powder", "chili powder", "curry powder", "cocoa powder",
      "salt", "pepper corn", "peppercorn", "black pepper", "white pepper", "cayenne",
      "paprika", "cumin", "coriander", "turmeric", "oregano", "thyme", "rosemary",
      "sage", "bay leaf", "bay leaves", "cinnamon", "nutmeg", "clove", "cardamom",
      "allspice", "chili flake", "red pepper flake", "seasoning", "spice", "herbes",
      "italian season", "everything bagel", "za'atar", "sumac", "saffron",
      "vanilla extract", "vanilla bean", "extract", "dill weed", "fennel seed",
      "mustard seed", "sesame seed", "poppy seed", "onion flake", "garlic salt",
    ]
  },
  {
    category: "spice", location: "fridge",
    words: [
      "fresh basil", "fresh cilantro", "fresh parsley", "fresh mint", "fresh dill",
      "fresh thyme", "fresh rosemary", "fresh ginger", "basil", "cilantro", "parsley",
      "mint", "dill", "chive", "tarragon", "lemongrass", "ginger root", "ginger",
    ]
  },

  // --- Drinks: checked early, so "coffee beans" is not a legume ---
  {
    category: "condiment", location: "pantry",
    words: ["coffee", "espresso", "tea bag", "cocoa", "kombucha", "seltzer", "sparkling water"],
  },

  // --- Protein ---
  {
    category: "protein", location: "fridge",
    words: [
      "chicken", "turkey", "beef", "steak", "sirloin", "ribeye", "brisket", "pork",
      "bacon", "ham", "sausage", "salami", "prosciutto", "lamb", "veal", "duck",
      "salmon", "tuna", "cod", "tilapia", "halibut", "haddock", "trout", "sardine",
      "anchov", "shrimp", "prawn", "scallop", "crab", "lobster", "mussel", "clam",
      "oyster", "fish", "egg", "tofu", "tempeh", "seitan", "protein powder",
      "protein shake", "jerky", "meatball", "burger patty", "ground meat",
    ]
  },

  // --- Dairy ---
  {
    category: "dairy", location: "fridge",
    words: [
      "milk", "oatmilk", "oat milk", "almondmilk", "almond milk", "soymilk",
      "soy milk", "yogurt", "yoghurt", "kefir", "cheese", "cheddar", "mozzarella",
      // Brands that only ever mean one thing on a receipt.
      "oikos", "chobani", "fage", "siggi", "skyr",
      "parmesan", "feta", "brie", "gouda", "ricotta", "mascarpone", "boursin",
      "cream cheese", "sour cream", "heavy cream", "half and half", "cottage",
      "half-and-half", "creamer", "whipped cream", "ghee",
    ]
  },

  // --- Fruit ---
  {
    category: "fruit", location: "fridge",
    words: [
      "apple", "banana", "orange", "clementine", "mandarin", "tangerine", "grape",
      "berry", "berries", "strawberr", "blueberr", "raspberr", "blackberr",
      "cranberr", "melon", "watermelon", "cantaloupe", "peach", "nectarine", "plum",
      "pear", "cherry", "cherries", "mango", "papaya", "pineapple", "kiwi",
      "pomegranate", "apricot", "fig", "date", "raisin", "lemon", "lime",
      "grapefruit", "juice", "fruit",
    ]
  },

  // --- Vegetables (shallots very much included) ---
  {
    category: "vegetable", location: "fridge",
    words: [
      "shallot", "scallion", "green onion", "spring onion", "leek", "onion",
      "garlic", "broccoli", "cauliflower", "cabbage", "kale", "spinach", "arugula",
      "lettuce", "romaine", "greens", "chard", "collard", "bok choy", "brussels",
      "asparagus", "green bean", "pea", "snap pea", "zucchini", "squash",
      "eggplant", "cucumber", "celery", "carrot", "radish", "beet", "turnip",
      "parsnip", "pepper", "jalapeno", "poblano", "serrano", "habanero", "chili",
      "tomato", "mushroom", "corn", "okra", "artichoke", "asparagus", "sprout",
      "vegetable", "veggie", "salad mix", "coleslaw", "slaw",
    ]
  },

  // --- Starchy veg ---
  { category: "starch", location: "pantry", words: ["potato", "yam", "plantain", "cassava"] },

  // --- Legumes ---
  {
    category: "legume", location: "pantry",
    words: ["bean", "lentil", "chickpea", "garbanzo", "hummus", "edamame", "split pea"]
  },

  // --- Nuts & seeds ---
  {
    category: "nut", location: "pantry",
    words: [
      "almond", "cashew", "pecan", "walnut", "pistachio", "hazelnut", "macadamia",
      "peanut", "nut butter", "mixed nut", "trail mix", "chia", "flax", "sunflower seed",
      "pinenut", "pine nut", "pignoli",
      "pumpkin seed", "tahini", "nut",
    ]
  },

  // --- Grains ---
  {
    category: "grain", location: "pantry",
    words: [
      "bread", "bagel", "roll", "bun", "tortilla", "wrap", "pita", "naan",
      "cracker", "pasta", "spaghetti", "penne", "macaroni", "noodle", "rice",
      "rotini", "fusilli", "linguine", "fettuccine", "angel hair", "orzo", "rigatoni",
      "quinoa", "farro", "barley", "couscous", "oat", "cereal", "granola", "muesli",
      "flour", "panko", "breadcrumb", "muffin", "waffle", "pancake mix", "tortilla chip",
    ]
  },

  // --- Fats & oils ---
  {
    category: "fat", location: "pantry",
    words: ["olive oil", "avocado oil", "canola oil", "vegetable oil", "sesame oil", "coconut oil", "oil", "butter", "lard", "shortening", "avocado"]
  },

  // --- Condiments (the door bin) ---
  {
    category: "condiment", location: "fridge",
    words: [
      "ketchup", "mustard", "mayo", "mayonnaise", "relish", "pickle", "salsa",
      "sriracha", "hot sauce", "soy sauce", "tamari", "fish sauce", "worcester",
      "bbq sauce", "barbecue", "teriyaki", "hoisin", "gochujang", "yangnyeom",
      "dressing", "vinaigrette", "ranch", "caesar", "aioli", "pesto", "chutney",
      "jam", "jelly", "preserve", "honey", "syrup", "vinegar", "marinade", "sauce",
    ]
  },
];

/**
 * Whether two words name the same thing.
 *
 * Two allowances, each needed by real receipts and each kept narrow enough not
 * to collide. Plurals only via actual plural endings — "blueberr" covers
 * "blueberries" while "clove" still does not cover "clover". And truncations,
 * because tills cut names to fit: "CUCUMB" is cucumber and "ROTIN" is rotini,
 * but only from five characters up, below which the stub means nothing.
 */
function sameWord(token: string, word: string): boolean {
  if (token === word) return true;
  if (token.startsWith(word)) {
    const tail = token.slice(word.length);
    if (tail === "s" || tail === "es" || tail === "ies") return true;
  }
  return word.startsWith(token) && token.length >= 5;
}

/** Match on whole words, so "Clover" is not a clove. */
function hasWord(haystack: string, phrase: string): boolean {
  const h = haystack.toLowerCase();
  if (phrase.includes(" ")) return h.includes(phrase);
  return h
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .some((token) => sameWord(token, phrase));
}

/** Reads a food's name and says where it belongs, or null if it can't tell. */
export function classifyByName(name: string): FoodPlacement | null {
  const n = name.toLowerCase();
  for (const rule of RULES) {
    if (rule.words.some((w) => hasWord(n, w))) {
      return { category: rule.category, location: rule.location };
    }
  }
  return null;
}

/** The label shown for a category, e.g. "Spices & herbs". */
export function categoryLabel(key: FoodCategory): string {
  return FOOD_CATEGORIES.find((c) => c.key === key)?.label ?? key;
}
