import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  ChefHat, ShoppingCart, Package, RefreshCw, X, Plus, Trash2,
  Check, Clock, Sparkles, Tags, AlertTriangle, ChevronDown,
  BookmarkPlus, Link2, Users, UploadCloud, DownloadCloud, Pencil, Calendar, BookOpen, Play,
} from "lucide-react";
import { subscribe as cloudSubscribe, getSnapshot as cloudSnapshot, isAdminUser, loadLibrary, saveLibraryRecipe, deleteLibraryRecipe, saveBuiltinRecipePhoto } from "./cloud.js";
import { pushState, pullState } from "./syncClient.js";
import { SplashScreen } from "@capacitor/splash-screen";
// Ads live entirely behind src/ads.js — the ads build ships the real AdMob
// version, the no-ads build ships a version where both calls do nothing —
// so this file is identical in both builds.
import { initAds, showInterstitialAd, AdSlot, SiteFooter } from "./ads.js";
import SimpleWeek from "./SimpleWeek.jsx";
import FoodArt from "./FoodArt.jsx";

/* ---------------------------------------------------------------
   TOKENS — "kitchen ledger" identity: deep jade + receipt paper,
   mustard for action, clay for "on sale". Fraunces for character,
   IBM Plex Sans for UI, IBM Plex Mono for anything list/receipt-like.
------------------------------------------------------------------*/
// "Cottage" palette — brown brick + oat plaster + moss, swapped in from the
// earlier wine-jade identity. Token names below (jade*, mustard, clay,
// sage) are kept as-is even though "jade" no longer means jade-green —
// renaming every C.jade900 etc. call site across the file would be a much
// bigger, riskier change for a palette swap that's cosmetic only.
const C = {
  jade900: "#303241",
  jade700: "#4A4C60",
  jade600: "#77788A",
  paper: "#F7F7FB",
  paperDim: "#F0EFF7",
  ink: "#303241",
  inkSoft: "#666A73",
  mustard: "#EAA28F",
  mustardDeep: "#D98976",
  clay: "#EAA28F",
  sage: "#B6B2E0",
  line: "#E5E3EE",
  // Darker variants of clay/sage for use as actual text (labels, error
  // messages, links) — the base tones read fine as backgrounds/icons/dots,
  // but fall short of WCAG AA (4.5:1) for small text on the cream/white
  // surfaces this app uses. Same hue family, just deep enough to read.
  clayText: "#A44B36",
  sageText: "#67677E",
};

const CATEGORY_DOT = {
  protein: C.clay,
  vegetable: C.sage,
  grain: C.mustard,
  noodle: C.mustardDeep,
  seasoning: C.jade600,
  dairy: "#9A9184",
  other: "#9A9184",
};

const FONT_DISPLAY = "'Fraunces', Georgia, serif";
const FONT_BODY = "'IBM Plex Sans', system-ui, sans-serif";
const FONT_MONO = "'IBM Plex Mono', ui-monospace, monospace";

/* ---------------------------------------------------------------
   DATA
------------------------------------------------------------------*/
const ing = (name, category, amount = null, unit = "") => ({ name, category, amount, unit });

const MEALS = [
  { id: "regional_tw_beef_noodles", name: "Taiwanese Braised Beef Noodle Soup", cuisine: "Chinese", region: "Taiwanese", protein: "beef", time: 180, baseServings: 4,
    ingredients: [ing("Beef shin or chuck","protein",700,"g"), ing("Wheat noodles","noodle",400,"g"), ing("Bok choy","vegetable",300,"g"), ing("Tomatoes","vegetable",2,"pcs"), ing("Onion","vegetable",1,"pc"), ing("Garlic","seasoning",5,"cloves"), ing("Ginger","seasoning",30,"g"), ing("Light soy sauce","seasoning",4,"tbsp"), ing("Dark soy sauce","seasoning",1,"tbsp"), ing("Star anise","seasoning",2,"pcs"), ing("Five-spice powder","seasoning",0.5,"tsp"), ing("Water or unsalted beef stock","other",1.5,"L"), ing("Cooking oil","seasoning",1,"tbsp")],
    steps: ["Cut beef into large chunks. Blanch in boiling water for 3 minutes, drain and rinse.", "Slice onion and ginger, crush garlic and quarter tomatoes. Heat oil in a large pot; soften onion, ginger and garlic for 3 minutes.", "Add beef, tomatoes, light soy sauce, dark soy sauce, star anise and five-spice powder. Stir for 2 minutes.", "Pour in stock or water, bring to a boil, then cover and simmer gently for 2 to 2½ hours until the beef is tender. Add water as needed and taste for seasoning.", "Cook wheat noodles separately according to packet directions. Blanch bok choy until just tender.", "Divide noodles and bok choy among four bowls. Ladle over beef and hot broth. Remove star anise before serving."],
    sourceUrl: "https://thewoksoflife.com/taiwanese-beef-noodle-soup-instant-pot/", freezerFriendly: true, completeMeal: true
  },

  { id: "m1", name: "Sweet & Sour Pork", cuisine: "Chinese", protein: "pork", time: 25, baseServings: 4,
    ingredients: [ing("Pork loin","protein",500,"g"), ing("Pineapple","vegetable",200,"g"), ing("Bell pepper","vegetable",150,"g"), ing("Ketchup","seasoning",3,"tbsp"), ing("Rice vinegar","seasoning",2,"tbsp"), ing("Cornstarch","seasoning",2,"tbsp"), ing("Rice","grain",3,"cups")],
    steps: ["Cut pork loin into bite-sized cubes and season lightly with salt and pepper.", "Toss the pork in cornstarch until evenly coated, shaking off excess.", "Heat oil in a wok and fry the pork in batches until golden and cooked through; drain and set aside.", "In the same wok, stir-fry the bell pepper briefly until just softened, then add the pineapple.", "Mix ketchup, rice vinegar, and a splash of water into the pan to form the sauce; bring to a simmer.", "Return the pork to the wok and toss well to coat in the sauce.", "Serve immediately over steamed rice while the coating is still glossy."] },
  { id: "m2", name: "Steamed Fish, Ginger & Scallion", cuisine: "Chinese", protein: "fish", time: 20, baseServings: 4,
    ingredients: [ing("White fish fillet","protein",500,"g"), ing("Scallion","seasoning",20,"g"), ing("Ginger","seasoning",20,"g"), ing("Light soy sauce","seasoning",2,"tbsp"), ing("Sesame oil","seasoning",1,"tbsp"), ing("Rice","grain",3,"cups")],
    steps: ["Pat the fish fillet dry and season lightly with a pinch of salt.", "Lay it on a heatproof plate with a few slices of ginger underneath and on top.", "Bring water to a rolling boil in a steamer and steam the fish for 8–10 minutes, until it flakes easily.", "While it steams, finely slice the scallion into thin strips.", "Once cooked, carefully pour off any liquid that's pooled on the plate.", "Scatter the scallion over the fish, then drizzle with light soy sauce.", "Heat sesame oil until just smoking and pour it over the top to finish — it should sizzle audibly.", "Serve immediately with steamed rice."] },
  { id: "m3", name: "Beef Hor Fun", cuisine: "Chinese", protein: "beef", time: 20, baseServings: 4,
    ingredients: [ing("Beef slices","protein",400,"g"), ing("Flat rice noodles","noodle",500,"g"), ing("Bean sprouts","vegetable",150,"g"), ing("Scallion","seasoning",20,"g"), ing("Dark soy sauce","seasoning",2,"tbsp"), ing("Egg","protein",2,"pcs")],
    steps: ["Marinate the beef slices briefly with a touch of soy sauce and cornstarch.", "Heat a wok until very hot, then sear the beef quickly in batches so it browns rather than stews; set aside.", "Loosen the flat rice noodles gently by hand so they don't tear.", "Add a little more oil and stir-fry the noodles with dark soy sauce until evenly coloured and slightly charred at the edges.", "Push the noodles aside, scramble the egg directly in the wok, then mix through.", "Add bean sprouts and scallion, tossing for under a minute so they stay crisp.", "Return the beef to the wok, toss everything together over high heat, and serve immediately."] },
  { id: "m4", name: "Claypot Chicken Rice", cuisine: "Chinese", protein: "chicken", time: 40, baseServings: 4,
    ingredients: [ing("Chicken thigh","protein",500,"g"), ing("Dried shiitake mushroom","vegetable",30,"g"), ing("Chinese sausage","protein",100,"g"), ing("Rice","grain",3,"cups"), ing("Dark soy sauce","seasoning",2,"tbsp"), ing("Ginger","seasoning",15,"g")],
    steps: ["Marinate the chicken thigh pieces with dark soy sauce and ginger for at least 15 minutes.", "Rinse the rice until the water runs mostly clear, then drain.", "Add the rice and measured water to a claypot along with the shiitake mushroom and sliced Chinese sausage.", "Bring to a simmer uncovered over medium heat until the water level drops to just below the rice.", "Arrange the marinated chicken on top, cover, and reduce to low heat.", "Cook covered for 15–18 minutes without lifting the lid, so the rice steams through evenly.", "Turn off the heat and let it rest, still covered, for 5 minutes to develop the crust at the bottom.", "Drizzle with a little extra dark soy sauce and serve straight from the pot."] },
  { id: "m5", name: "Egg Fried Rice", cuisine: "Chinese", protein: "egg", time: 15, baseServings: 4,
    ingredients: [ing("Egg","protein",4,"pcs"), ing("Rice","grain",4,"cups"), ing("Scallion","seasoning",20,"g"), ing("Frozen peas & carrot","vegetable",150,"g"), ing("Light soy sauce","seasoning",2,"tbsp")],
    steps: ["Beat the egg lightly in a bowl.", "Heat oil in a wok until shimmering, then scramble the egg quickly; remove and set aside.", "Add the day-old rice to the wok, breaking up any clumps with the back of a spatula.", "Stir-fry over high heat until the rice is heated through and separating into individual grains.", "Add the frozen peas & carrot and scallion, tossing until warmed through.", "Season with light soy sauce around the edges of the wok, then toss to combine.", "Fold the scrambled egg back in and serve hot."] },
  { id: "m6", name: "Mapo Tofu", cuisine: "Chinese", protein: "pork", time: 20, baseServings: 4,
    ingredients: [ing("Silken tofu","protein",400,"g"), ing("Minced pork","protein",300,"g"), ing("Doubanjiang","seasoning",2,"tbsp"), ing("Scallion","seasoning",15,"g"), ing("Garlic","seasoning",3,"cloves"), ing("Rice","grain",3,"cups")],
    steps: ["Cut the silken tofu into cubes and set aside gently — it's delicate.", "Heat oil in a pan and brown the minced pork thoroughly, breaking it into small pieces.", "Add garlic and stir-fry briefly until fragrant.", "Stir in doubanjiang and cook for a minute until the oil turns red and fragrant.", "Add a splash of water and bring to a simmer.", "Carefully slide in the tofu cubes, spooning the sauce over them rather than stirring roughly.", "Simmer gently for 3–4 minutes so the tofu absorbs the flavour without breaking apart.", "Top with scallion and serve immediately with rice."] },
  { id: "m7", name: "Chicken & Sweetcorn Soup", cuisine: "Chinese", protein: "chicken", time: 20, baseServings: 4,
    ingredients: [ing("Chicken breast","protein",200,"g"), ing("Creamed corn","vegetable",400,"g"), ing("Egg","protein",2,"pcs"), ing("Cornstarch","seasoning",1,"tbsp")],
    steps: ["Bring stock to a simmer in a pot.", "Add shredded or finely diced chicken breast and poach until just cooked through.", "Stir in the creamed corn and bring back to a simmer.", "Mix cornstarch with a little cold water to make a slurry, then stir it in to thicken slightly.", "Beat the egg in a separate bowl.", "Drizzle the egg slowly into the simmering soup while stirring in one direction to form fine ribbons.", "Season to taste and serve hot."] },
  { id: "m8", name: "Stir-Fry Kailan, Garlic", cuisine: "Chinese", protein: "vegetarian", time: 10, baseServings: 4,
    ingredients: [ing("Kailan","vegetable",400,"g"), ing("Garlic","seasoning",3,"cloves"), ing("Oyster sauce","seasoning",2,"tbsp"), ing("Rice","grain",3,"cups")],
    steps: ["Trim the tough ends off the kailan and cut into manageable lengths.", "Blanch briefly in boiling water for about a minute, then drain well.", "Heat oil in a wok and fry the garlic until just golden, taking care not to burn it.", "Add the kailan and toss quickly over high heat for a minute or two.", "Stir in oyster sauce, tossing to coat evenly.", "Serve immediately with rice while still bright green and crisp."] },
  { id: "m9", name: "Bak Kut Teh", cuisine: "Chinese", protein: "pork", time: 60, baseServings: 4,
    ingredients: [ing("Pork ribs","protein",800,"g"), ing("Garlic","seasoning",8,"cloves"), ing("White pepper","seasoning",1,"tbsp"), ing("Bak kut teh spice packet","seasoning",1,"pcs"), ing("Rice","grain",4,"cups")],
    steps: ["Blanch the pork ribs in boiling water for a few minutes to remove impurities, then rinse under cold water.", "Bring a fresh pot of water to a boil and add the ribs, whole garlic cloves, and the spice packet.", "Bring back to a boil, then reduce to a gentle simmer.", "Skim any foam that rises to the surface during the first 15 minutes.", "Continue simmering, partially covered, for 45–60 minutes until the meat is very tender.", "Season with white pepper to taste toward the end of cooking.", "Ladle into bowls, making sure each gets ribs, garlic cloves, and broth.", "Serve with rice and, if you like, a side of soy sauce with sliced chilli."] },
  { id: "m10", name: "Wonton Noodle Soup", cuisine: "Chinese", protein: "pork", time: 30, baseServings: 4,
    ingredients: [ing("Wonton wrappers","other",20,"pcs"), ing("Minced pork","protein",300,"g"), ing("Egg noodles","noodle",400,"g"), ing("Scallion","seasoning",15,"g"), ing("Light soy sauce","seasoning",2,"tbsp")],
    steps: ["Mix the minced pork filling with a little seasoning until well combined.", "Place a small spoonful of filling in the centre of each wonton wrapper.", "Wet the edges lightly, fold into a pouch, and press to seal.", "Bring a pot of water to a gentle boil and cook the wontons until they float, about 4–5 minutes.", "In a separate pot, cook the egg noodles briefly until just tender, then drain.", "Warm the broth in another pot and season with light soy sauce.", "Divide the noodles between bowls, top with the wontons, and ladle over the hot broth.", "Garnish with scallion and serve immediately."] },
  { id: "m11", name: "Nasi Lemak", cuisine: "Malay", protein: "chicken", time: 45, baseServings: 4,
    ingredients: [ing("Rice","grain",3,"cups"), ing("Coconut milk","other",200,"ml"), ing("Fried chicken wing","protein",8,"pcs"), ing("Sambal","seasoning",4,"tbsp"), ing("Cucumber","vegetable",2,"pcs"), ing("Egg","protein",4,"pcs"), ing("Anchovies","protein",50,"g")],
    steps: ["Cook rice with coconut milk until fragrant.", "Fry the chicken wing until golden and cooked through.", "Fry anchovies until crisp and prepare the egg.", "Slice the cucumber.", "Warm the sambal through if it isn't freshly made.", "Plate rice with chicken, egg, anchovies, cucumber and sambal.", "Serve immediately."] },
  { id: "m12", name: "Chicken Rendang", cuisine: "Malay", protein: "chicken", time: 50, baseServings: 4,
    ingredients: [ing("Chicken thigh","protein",600,"g"), ing("Coconut milk","other",400,"ml"), ing("Rendang paste","seasoning",4,"tbsp"), ing("Rice","grain",3,"cups")],
    steps: ["Brown the chicken thigh pieces in a hot pot until coloured on all sides; remove and set aside.", "In the same pot, add the rendang paste and cook over medium heat until fragrant, stirring often.", "Return the chicken to the pot and stir to coat in the paste.", "Pour in the coconut milk and bring to a gentle simmer.", "Reduce the heat and simmer uncovered, stirring occasionally, for 30–40 minutes.", "Continue cooking until the sauce has reduced and darkened, clinging thickly to the chicken.", "Taste and adjust seasoning, then serve with rice once the oil starts to separate slightly at the edges."] },
  { id: "m13", name: "Mee Goreng", cuisine: "Malay", protein: "egg", time: 20, baseServings: 4,
    ingredients: [ing("Yellow noodles","noodle",500,"g"), ing("Egg","protein",3,"pcs"), ing("Bean sprouts","vegetable",150,"g"), ing("Tomato sauce","seasoning",3,"tbsp"), ing("Tofu","protein",200,"g")],
    steps: ["Fry the tofu until golden, then set aside.", "Loosen the yellow noodles by hand so they separate easily.", "Stir-fry the noodles with tomato sauce until evenly coated and catching slightly at the edges.", "Push noodles aside, scramble the egg, then mix through.", "Add bean sprouts and fried tofu, tossing briefly so the sprouts stay crunchy.", "Serve hot, straight from the wok."] },
  { id: "m14", name: "Sambal Sotong", cuisine: "Malay", protein: "seafood", time: 20, baseServings: 4,
    ingredients: [ing("Squid","protein",500,"g"), ing("Sambal","seasoning",4,"tbsp"), ing("Onion","vegetable",1,"pcs"), ing("Rice","grain",3,"cups")],
    steps: ["Clean the squid thoroughly and score the body in a shallow crosshatch pattern.", "Slice the onion thinly.", "Fry onion until soft, then add sambal and cook until fragrant.", "Add the squid and toss over high heat for no more than 1–2 minutes.", "Remove from heat as soon as it curls and turns opaque, to avoid it turning rubbery.", "Serve hot with rice."] },
  { id: "m15", name: "Ikan Bakar", cuisine: "Malay", protein: "fish", time: 30, baseServings: 4,
    ingredients: [ing("Whole fish","protein",1,"pcs"), ing("Sambal","seasoning",4,"tbsp"), ing("Lime","seasoning",2,"pcs"), ing("Rice","grain",3,"cups")],
    steps: ["Score the whole fish and rub with sambal, inside and out.", "Marinate for at least 20 minutes.", "Grill or pan-sear until the skin is charred and cooked through.", "Check doneness near the bone at the thickest part.", "Squeeze fresh lime over the top and serve with rice."] },
  { id: "m16", name: "Butter Chicken", cuisine: "Indian", protein: "chicken", time: 40, baseServings: 4,
    ingredients: [ing("Chicken thigh","protein",600,"g"), ing("Tomato puree","seasoning",300,"g"), ing("Butter","dairy",3,"tbsp"), ing("Cream","dairy",150,"ml"), ing("Garam masala","seasoning",2,"tbsp"), ing("Rice","grain",3,"cups")],
    steps: ["Sear the chicken until browned; it doesn't need to be fully cooked yet.", "Melt butter and cook down the tomato puree with garam masala until it deepens in colour.", "Stir in the cream and bring to a gentle simmer.", "Return the chicken, simmer until cooked through, 10–15 minutes.", "Taste and adjust, adding a touch more butter or cream if needed.", "Serve hot with rice, spooning extra sauce over the top."] },
  { id: "m17", name: "Chana Masala", cuisine: "Indian", protein: "vegetarian", time: 30, baseServings: 4,
    ingredients: [ing("Chickpeas","protein",400,"g"), ing("Tomato","vegetable",300,"g"), ing("Onion","vegetable",1,"pcs"), ing("Garam masala","seasoning",2,"tbsp"), ing("Rice","grain",3,"cups")],
    steps: ["Fry onion until deeply golden.", "Add garam masala and cook until fragrant.", "Add tomato and cook down into a thick, jammy base.", "Stir in the chickpeas along with a splash of water.", "Simmer for 10–15 minutes, mashing a few chickpeas to help thicken.", "Adjust seasoning and serve with rice."] },
  { id: "m18", name: "Fish Curry", cuisine: "Indian", protein: "fish", time: 35, baseServings: 4,
    ingredients: [ing("Fish fillet","protein",500,"g"), ing("Curry powder","seasoning",3,"tbsp"), ing("Coconut milk","other",400,"ml"), ing("Okra","vegetable",200,"g"), ing("Rice","grain",3,"cups")],
    steps: ["Toast curry powder briefly in oil until fragrant.", "Add coconut milk and bring to a gentle simmer.", "Add okra and simmer until nearly tender, 5–7 minutes.", "Season the fish and slide it into the curry.", "Poach gently until just cooked through.", "Serve immediately with rice."] },
  { id: "m19", name: "Dal Tadka", cuisine: "Indian", protein: "vegetarian", time: 25, baseServings: 4,
    ingredients: [ing("Red lentils","protein",300,"g"), ing("Garlic","seasoning",3,"cloves"), ing("Cumin seed","seasoning",1,"tsp"), ing("Turmeric","seasoning",1,"tsp"), ing("Rice","grain",3,"cups")],
    steps: ["Simmer red lentils with turmeric until soft and creamy.", "In a separate pan, fry garlic and cumin seed in oil until fragrant.", "Pour the sizzling tadka straight over the cooked lentils.", "Stir through immediately so the aromatics infuse evenly.", "Serve hot with rice."] },
  { id: "m20", name: "Prata & Egg Curry", cuisine: "Indian", protein: "egg", time: 15, baseServings: 4,
    ingredients: [ing("Frozen prata","other",8,"pcs"), ing("Egg","protein",4,"pcs"), ing("Curry sauce","seasoning",300,"ml")],
    steps: ["Pan-fry the frozen prata until golden and flaky.", "Fry the egg to your liking.", "Warm the curry sauce through.", "Cut the prata into wedges.", "Serve the prata and egg with the curry sauce for dipping."] },
  { id: "m21", name: "Beef Rendang Buah Keluak", cuisine: "Peranakan", protein: "beef", time: 90, baseServings: 4,
    ingredients: [ing("Beef cubes","protein",700,"g"), ing("Buah keluak","other",12,"pcs"), ing("Tamarind","seasoning",2,"tbsp"), ing("Rice","grain",3,"cups")],
    steps: ["Brown the beef cubes in batches; set aside.", "Add tamarind and buah keluak with enough water to just cover.", "Return the beef and bring to a boil.", "Reduce to a low simmer and cover partially, stirring occasionally.", "Simmer for at least an hour, topping up water if needed.", "Leave the lid off for the last 20 minutes to reduce the sauce.", "Serve with rice once thick and fragrant."] },
  { id: "m22", name: "Babi Pongteh", cuisine: "Peranakan", protein: "pork", time: 60, baseServings: 4,
    ingredients: [ing("Pork belly","protein",600,"g"), ing("Fermented soybean paste","seasoning",3,"tbsp"), ing("Potato","vegetable",300,"g"), ing("Shiitake mushroom","vegetable",50,"g"), ing("Rice","grain",3,"cups")],
    steps: ["Brown the pork belly pieces; set aside.", "Stir in fermented soybean paste until fragrant.", "Add potato, mushroom, and the pork back with water to cover.", "Simmer covered for 40–45 minutes, stirring occasionally.", "Remove the lid to reduce the sauce once the pork is tender.", "Serve with rice."] },
  { id: "m23", name: "Otah Otah", cuisine: "Peranakan", protein: "fish", time: 30, baseServings: 4,
    ingredients: [ing("Fish paste","protein",500,"g"), ing("Coconut milk","other",100,"ml"), ing("Chili paste","seasoning",3,"tbsp"), ing("Banana leaf","other",8,"pcs")],
    steps: ["Mix the fish paste with coconut milk and chili paste.", "Spoon the mixture onto banana leaf and fold into parcels.", "Grill or steam the parcels until firm and cooked through.", "Let cool slightly before unwrapping, and serve warm."] },
  { id: "m24", name: "Roast Chicken & Root Veg", cuisine: "Western", protein: "chicken", time: 60, baseServings: 4,
    ingredients: [ing("Whole chicken","protein",1,"pcs"), ing("Potato","vegetable",500,"g"), ing("Carrot","vegetable",300,"g"), ing("Rosemary","seasoning",4,"sprigs"), ing("Olive oil","seasoning",3,"tbsp")],
    steps: ["Preheat the oven to a high roasting temperature.", "Rub the chicken with olive oil, salt and rosemary, including under the skin if possible.", "Arrange potato and carrot around the chicken.", "Roast, basting occasionally, until golden and cooked through.", "Check doneness by piercing the thigh — juices should run clear.", "Rest for 10 minutes before carving and serving."] },
  { id: "m25", name: "Spaghetti Aglio Olio", cuisine: "Western", protein: "vegetarian", time: 15, baseServings: 4,
    ingredients: [ing("Spaghetti","noodle",400,"g"), ing("Garlic","seasoning",6,"cloves"), ing("Chili flakes","seasoning",1,"tsp"), ing("Olive oil","seasoning",4,"tbsp"), ing("Parmesan","dairy",50,"g")],
    steps: ["Cook the spaghetti until al dente, reserving some pasta water.", "Gently warm olive oil with garlic and chili flakes until fragrant, not browned.", "Toss the drained spaghetti through the oil, loosening with pasta water.", "Remove from heat and stir in the parmesan.", "Serve immediately while hot."] },
  { id: "m26", name: "Beef Bolognese", cuisine: "Western", protein: "beef", time: 35, baseServings: 4,
    ingredients: [ing("Minced beef","protein",500,"g"), ing("Spaghetti","noodle",400,"g"), ing("Tomato puree","seasoning",400,"g"), ing("Onion","vegetable",1,"pcs"), ing("Garlic","seasoning",3,"cloves")],
    steps: ["Brown the minced beef with onion and garlic.", "Stir in tomato puree and simmer, partially covered, for at least 20 minutes.", "Cook the spaghetti separately until al dente.", "Taste the sauce and adjust seasoning.", "Toss the pasta through the sauce and serve."] },
  { id: "m27", name: "Grilled Salmon & Greens", cuisine: "Western", protein: "fish", time: 20, baseServings: 4,
    ingredients: [ing("Salmon fillet","protein",600,"g"), ing("Mixed greens","vegetable",200,"g"), ing("Lemon","seasoning",1,"pcs"), ing("Olive oil","seasoning",2,"tbsp")],
    steps: ["Rub the salmon with olive oil and season.", "Sear skin-side down until crisp, then flip briefly to finish.", "Toss mixed greens with lemon and a little olive oil.", "Plate the salmon over the greens and serve."] },
  { id: "m28", name: "Fish & Chips", cuisine: "Western", protein: "fish", time: 30, baseServings: 4,
    ingredients: [ing("Fish fillet","protein",600,"g"), ing("Potato","vegetable",600,"g"), ing("Flour","seasoning",150,"g"), ing("Cooking oil","seasoning",500,"ml")],
    steps: ["Cut potato into chips and fry or bake until golden.", "Pat the fish dry and season lightly.", "Coat the fish in a light flour batter.", "Fry the fish until golden and cooked through.", "Serve hot together with the chips."] },
  { id: "m29", name: "Chicken Teriyaki Don", cuisine: "Japanese", protein: "chicken", time: 20, baseServings: 4,
    ingredients: [ing("Chicken thigh","protein",600,"g"), ing("Rice","grain",4,"cups"), ing("Teriyaki sauce","seasoning",4,"tbsp"), ing("Scallion","seasoning",15,"g")],
    steps: ["Sear chicken thigh skin-side down until golden.", "Flip and cook through, then add teriyaki sauce to the pan.", "Simmer, turning to glaze evenly.", "Slice the chicken into strips.", "Serve over rice with scallion on top."] },
  { id: "m30", name: "Miso Soup & Tofu", cuisine: "Japanese", protein: "tofu", time: 10, baseServings: 4,
    ingredients: [ing("Miso paste","seasoning",4,"tbsp"), ing("Tofu","protein",300,"g"), ing("Seaweed","vegetable",10,"g"), ing("Scallion","seasoning",10,"g")],
    steps: ["Bring a light stock to a gentle simmer.", "Whisk miso paste into a ladle of the hot liquid until smooth.", "Pour the dissolved miso back into the pot.", "Add cubed tofu and seaweed, warming through gently.", "Ladle into bowls and top with scallion."] },
  { id: "m31", name: "Salmon Onigiri", cuisine: "Japanese", protein: "fish", time: 20, baseServings: 4,
    ingredients: [ing("Salmon flake","protein",150,"g"), ing("Rice","grain",4,"cups"), ing("Nori","other",4,"pcs"), ing("Sesame seed","seasoning",1,"tbsp")],
    steps: ["Cook and lightly season the rice.", "Flake the salmon and mix through a portion of the rice.", "Shape into triangles, wrapping with a strip of nori.", "Sprinkle with sesame seed and serve."] },
  { id: "m32", name: "Chicken Katsu Curry", cuisine: "Japanese", protein: "chicken", time: 30, baseServings: 4,
    ingredients: [ing("Chicken breast","protein",600,"g"), ing("Panko","other",150,"g"), ing("Curry roux","seasoning",100,"g"), ing("Rice","grain",4,"cups")],
    steps: ["Coat the chicken in panko and fry until golden and cooked through.", "Slice the katsu.", "Warm the curry roux with a little water until it thickens.", "Serve over rice, topped with the curry sauce."] },
  { id: "m33", name: "Bibimbap", cuisine: "Korean", protein: "beef", time: 30, baseServings: 4,
    ingredients: [ing("Beef strips","protein",400,"g"), ing("Rice","grain",4,"cups"), ing("Egg","protein",4,"pcs"), ing("Spinach","vegetable",200,"g"), ing("Gochujang","seasoning",3,"tbsp"), ing("Carrot","vegetable",150,"g")],
    steps: ["Cook the rice and keep warm.", "Sauté the beef strips, carrot and spinach separately, seasoning lightly.", "Fry an egg, keeping the yolk soft.", "Assemble everything over rice with gochujang.", "Mix everything together thoroughly just before eating."] },
  { id: "m34", name: "Kimchi Jjigae", cuisine: "Korean", protein: "pork", time: 25, baseServings: 4,
    ingredients: [ing("Kimchi","vegetable",300,"g"), ing("Pork belly","protein",300,"g"), ing("Tofu","protein",300,"g"), ing("Gochujang","seasoning",2,"tbsp"), ing("Rice","grain",3,"cups")],
    steps: ["Sauté the pork belly until lightly browned.", "Add kimchi and cook until fragrant.", "Pour in water and bring to a boil.", "Stir in the gochujang until dissolved.", "Simmer 10–15 minutes, add tofu in the last few minutes.", "Serve bubbling hot with rice."] },
  { id: "m35", name: "Japchae", cuisine: "Korean", protein: "beef", time: 25, baseServings: 4,
    ingredients: [ing("Glass noodles","noodle",300,"g"), ing("Beef strips","protein",300,"g"), ing("Spinach","vegetable",150,"g"), ing("Carrot","vegetable",150,"g"), ing("Sesame oil","seasoning",2,"tbsp")],
    steps: ["Soak and boil the glass noodles until tender; drain.", "Toss the noodles with a little sesame oil.", "Sauté the beef strips until browned; set aside.", "Sauté carrot, then blanch or sauté the spinach.", "Combine everything and toss with sesame oil.", "Serve warm or at room temperature."] },
  { id: "m36", name: "Vegetable Stir-Fry & Tofu", cuisine: "Chinese", protein: "vegetarian", time: 15, baseServings: 4, side: true,
    ingredients: [ing("Tofu","protein",400,"g"), ing("Mixed vegetables","vegetable",400,"g"), ing("Garlic","seasoning",3,"cloves"), ing("Oyster sauce","seasoning",2,"tbsp"), ing("Rice","grain",3,"cups")],
    steps: ["Cut the tofu into slabs and pat dry to help it crisp.", "Pan-fry the tofu until lightly golden; set aside.", "Fry garlic until just fragrant.", "Add the mixed vegetables and toss until just tender.", "Return the tofu, add oyster sauce, toss to coat.", "Serve immediately with rice."] },
  // Simple standalone dishes — meant to pair up (a protein-only dish here +
  // a vegetable-only one) rather than always needing one all-in-one dish
  // to cover both food groups.
  { id: "m37", name: "Fried Egg", cuisine: "Western", protein: "egg", time: 5, baseServings: 4, side: true,
    ingredients: [ing("Egg","protein",4,"pcs"), ing("Cooking oil","seasoning",1,"tbsp"), ing("Light soy sauce","seasoning",1,"tbsp")],
    steps: ["Heat a little oil in a non-stick pan over medium heat.", "Crack in the eggs, spaced apart, and season lightly.", "Fry until the whites are set and the edges turn lightly golden, 2–3 minutes.", "Flip briefly if you prefer a fully-set yolk, or leave sunny-side up.", "Drizzle with a little light soy sauce and serve immediately."] },
  { id: "m38", name: "Fried Luncheon Meat", cuisine: "Chinese", protein: "pork", time: 5, baseServings: 4, side: true,
    ingredients: [ing("Luncheon meat","protein",300,"g"), ing("Cooking oil","seasoning",1,"tbsp")],
    steps: ["Slice the luncheon meat into even pieces.", "Heat oil in a pan over medium-high heat.", "Fry the luncheon meat until browned and slightly crisp on both sides.", "Drain briefly on paper towels and serve hot."] },
  { id: "m39", name: "Stir-Fried Cabbage", cuisine: "Chinese", protein: "vegetarian", time: 10, baseServings: 4, side: true,
    ingredients: [ing("Cabbage","vegetable",400,"g"), ing("Garlic","seasoning",2,"cloves"), ing("Oyster sauce","seasoning",2,"tbsp")],
    steps: ["Cut the cabbage into bite-sized pieces.", "Heat oil in a wok and fry the garlic until fragrant.", "Add the cabbage and stir-fry over high heat until just wilted.", "Stir in oyster sauce, toss to coat, and serve."] },
  { id: "m40", name: "Sautéed Spinach with Garlic", cuisine: "Chinese", protein: "vegetarian", time: 8, baseServings: 4, side: true,
    ingredients: [ing("Spinach","vegetable",300,"g"), ing("Garlic","seasoning",3,"cloves"), ing("Sesame oil","seasoning",1,"tbsp")],
    steps: ["Wash the spinach thoroughly and drain well.", "Heat oil in a pan and fry the garlic until fragrant.", "Add the spinach and toss quickly over high heat until just wilted.", "Drizzle with sesame oil and serve immediately."] },
  { id: "m41", name: "Stir-Fried Long Beans", cuisine: "Malay", protein: "vegetarian", time: 10, baseServings: 4, side: true,
    ingredients: [ing("Long beans","vegetable",300,"g"), ing("Garlic","seasoning",2,"cloves"), ing("Sambal","seasoning",1,"tbsp")],
    steps: ["Trim and cut the long beans into short lengths.", "Heat oil in a wok and fry the garlic until fragrant.", "Add the long beans and stir-fry over high heat until just tender.", "Stir in sambal, toss to coat, and serve."] },
  // Same-cuisine standalone sides for Japanese and Korean mains, so a dish
  // like Chicken Katsu Curry doesn't only ever get paired with a Chinese
  // side (e.g. stir-fried kailan) for lack of anything else in the pool.
  { id: "m42", name: "Goma-ae Spinach", cuisine: "Japanese", protein: "vegetarian", time: 10, baseServings: 4, side: true,
    ingredients: [ing("Spinach","vegetable",300,"g"), ing("Sesame seeds","seasoning",2,"tbsp"), ing("Light soy sauce","seasoning",1,"tbsp"), ing("Sugar","seasoning",1,"tsp")],
    steps: ["Blanch the spinach briefly, then plunge into cold water and squeeze dry.", "Toast the sesame seeds lightly and grind roughly.", "Mix the ground sesame with soy sauce and sugar to make the dressing.", "Cut the spinach into short lengths and toss with the dressing.", "Serve chilled or at room temperature."] },
  { id: "m43", name: "Yakitori Chicken Skewers", cuisine: "Japanese", protein: "chicken", time: 18, baseServings: 4, side: true,
    ingredients: [ing("Chicken thigh","protein",500,"g"), ing("Light soy sauce","seasoning",2,"tbsp"), ing("Mirin","seasoning",2,"tbsp"), ing("Sugar","seasoning",1,"tbsp")],
    steps: ["Cut the chicken thigh into bite-sized pieces and thread onto skewers.", "Mix soy sauce, mirin and sugar to make the tare sauce.", "Grill or pan-sear the skewers, turning occasionally, until cooked through.", "Brush with the tare sauce in the last few minutes, letting it glaze and caramelize slightly.", "Serve hot, with extra tare on the side."] },
  { id: "m44", name: "Sigeumchi Namul (Korean Spinach)", cuisine: "Korean", protein: "vegetarian", time: 10, baseServings: 4, side: true,
    ingredients: [ing("Spinach","vegetable",300,"g"), ing("Garlic","seasoning",2,"cloves"), ing("Sesame oil","seasoning",1,"tbsp"), ing("Sesame seeds","seasoning",1,"tbsp")],
    steps: ["Blanch the spinach briefly, then rinse in cold water and squeeze dry.", "Cut into short lengths.", "Toss with minced garlic, sesame oil and a pinch of salt.", "Top with sesame seeds and serve at room temperature."] },
  { id: "m45", name: "Korean Bulgogi Beef Bites", cuisine: "Korean", protein: "beef", time: 20, baseServings: 4, side: true,
    ingredients: [ing("Beef slices","protein",500,"g"), ing("Light soy sauce","seasoning",3,"tbsp"), ing("Garlic","seasoning",2,"cloves"), ing("Sugar","seasoning",1,"tbsp"), ing("Sesame oil","seasoning",1,"tbsp")],
    steps: ["Mix soy sauce, minced garlic, sugar and sesame oil to make the marinade.", "Marinate the beef slices for at least 20 minutes.", "Heat a pan over high heat and sear the beef in batches until browned.", "Serve hot, sprinkled with extra sesame seeds if you like."] },
  // Gap-filling sides — Western, Malay, Indian and Peranakan mains had
  // little or no same-cuisine side to pair with, so a Fish Curry or Butter
  // Chicken would always fall back to a Chinese/Japanese/Korean side by
  // default (the "not enough dish bank" mixing). Every cuisine now has at
  // least one veg-only and one meat-only standalone side of its own.
  { id: "m46", name: "Buttered Corn & Peas", cuisine: "Western", protein: "vegetarian", time: 8, baseServings: 4, side: true,
    ingredients: [ing("Corn kernels","vegetable",250,"g"), ing("Peas","vegetable",150,"g"), ing("Butter","dairy",2,"tbsp")],
    steps: ["Heat the corn and peas through, from frozen or fresh, until just tender.", "Stir in the butter until melted and glossy.", "Season with a little salt and pepper and serve hot."] },
  { id: "m47", name: "Grilled Chicken Sausages", cuisine: "Western", protein: "chicken", time: 12, baseServings: 4, side: true,
    ingredients: [ing("Chicken sausage","protein",8,"pcs"), ing("Cooking oil","seasoning",1,"tbsp")],
    steps: ["Prick the sausages lightly so they don't burst.", "Pan-grill or pan-fry over medium heat, turning occasionally, until browned all over and cooked through.", "Rest briefly, then serve hot."] },
  { id: "m48", name: "Ayam Percik Bites (Grilled Chicken)", cuisine: "Malay", protein: "chicken", time: 25, baseServings: 4, side: true,
    ingredients: [ing("Chicken thigh","protein",500,"g"), ing("Coconut milk","other",100,"ml"), ing("Sambal","seasoning",2,"tbsp")],
    steps: ["Mix the coconut milk and sambal into a marinade.", "Marinate the chicken thigh for at least 20 minutes.", "Grill or pan-sear until charred in spots and cooked through, basting with the marinade partway.", "Serve hot."] },
  { id: "m49", name: "Bhindi Fry (Sautéed Okra)", cuisine: "Indian", protein: "vegetarian", time: 15, baseServings: 4, side: true,
    ingredients: [ing("Okra","vegetable",300,"g"), ing("Onion","vegetable",1,"pcs"), ing("Mustard seeds","seasoning",1,"tsp"), ing("Turmeric","seasoning",1,"tsp")],
    steps: ["Trim and slice the okra; pat thoroughly dry to help it crisp rather than turn slimy.", "Fry mustard seeds in oil until they pop.", "Add sliced onion and fry until softened.", "Add the okra and turmeric, and stir-fry over fairly high heat until tender and lightly browned.", "Season with salt and serve."] },
  { id: "m50", name: "Tandoori Chicken Bites", cuisine: "Indian", protein: "chicken", time: 25, baseServings: 4, side: true,
    ingredients: [ing("Chicken thigh","protein",500,"g"), ing("Yogurt","dairy",3,"tbsp"), ing("Curry powder","seasoning",2,"tbsp")],
    steps: ["Mix the yogurt and curry powder into a marinade.", "Marinate the chicken thigh for at least 30 minutes, longer if you have time.", "Grill, bake or pan-sear until charred in spots and cooked through.", "Serve hot."] },
  { id: "m51", name: "Kangkong Belacan", cuisine: "Peranakan", protein: "vegetarian", time: 10, baseServings: 4, side: true,
    ingredients: [ing("Kangkong","vegetable",350,"g"), ing("Belacan","seasoning",1,"tbsp"), ing("Garlic","seasoning",2,"cloves"), ing("Chili","seasoning",1,"pcs")],
    steps: ["Wash the kangkong well and cut into short lengths.", "Fry garlic and chili in oil until fragrant.", "Stir in the belacan and cook briefly until fragrant.", "Add the kangkong and stir-fry over high heat until just wilted.", "Serve immediately."] },
  { id: "m52", name: "Otah-Otah Fish Bites", cuisine: "Peranakan", protein: "fish", time: 20, baseServings: 4, side: true,
    ingredients: [ing("Fish fillet","protein",400,"g"), ing("Coconut milk","other",100,"ml"), ing("Sambal","seasoning",2,"tbsp")],
    steps: ["Blend or mash the fish fillet with the coconut milk and sambal into a paste.", "Shape into small patties.", "Steam or pan-fry until firm and cooked through.", "Serve hot."] },
];

const LOCATIONS = [
  { id: "pantry", label: "Pantry shelf" },
  { id: "fridge", label: "Fridge" },
  { id: "freezer", label: "Freezer" },
];

// Best-guess default for where something newly bought probably belongs,
// based on its ingredient category — meat/veg/dairy go to the fridge,
// shelf-stable stuff stays on the pantry shelf. Just a starting point;
// it's always editable afterward.
const CATEGORY_DEFAULT_LOCATION = {
  protein: "fridge",
  dairy: "fridge",
  vegetable: "fridge",
  grain: "pantry",
  noodle: "pantry",
  seasoning: "pantry",
  other: "pantry",
};

// Weekend-prep classification — inferred from the ingredient itself rather
// than tagged per-recipe, so every dish (built-in or manually added) gets
// this for free. Aromatics and vegetables can be chopped/washed once and
// bagged for the week; raw proteins either get marinated a day or two ahead
// or, if they're the kind usually bought in bulk, portioned and frozen.
const PREP_AROMATIC_NAMES = ["garlic", "ginger", "onion", "shallot", "scallion", "spring onion", "lemongrass"];
const PREP_FREEZE_PROTEIN_NAMES = ["minced pork", "minced chicken", "minced beef", "plant-based mince"];
const PREP_MARINATE_PROTEIN_NAMES = [
  "chicken thigh", "chicken breast", "chicken drumstick", "chicken wing",
  "pork loin", "pork ribs", "pork belly",
  "beef slices", "beef strips", "beef cubes",
  "prawns", "squid", "fish fillet", "salmon fillet", "white fish fillet", "whole fish",
];
// Quick "how" hints so a prep checklist item is actually actionable without
// flipping back to the recipe — matched by substring against common names,
// with a sensible generic fallback for anything not explicitly listed.
const CUT_HINTS = [
  { match: "garlic", note: "mince or slice thin" },
  { match: "ginger", note: "peel, then slice or julienne" },
  { match: "shallot", note: "slice thin" },
  { match: "onion", note: "slice or dice" },
  { match: "scallion", note: "cut into short lengths" },
  { match: "spring onion", note: "cut into short lengths" },
  { match: "lemongrass", note: "bruise, then slice the white part" },
  { match: "cabbage", note: "cut into bite-sized pieces" },
  { match: "spinach", note: "trim the roots and wash well" },
  { match: "carrot", note: "peel, then slice or julienne" },
  { match: "long beans", note: "trim ends, cut into short lengths" },
  { match: "bean sprouts", note: "rinse; trim tails if you like" },
  { match: "mixed vegetables", note: "wash and cut into bite-sized pieces" },
];
function getCutHint(name) {
  const n = name.toLowerCase();
  const hit = CUT_HINTS.find(h => n.includes(h.match));
  return hit ? hit.note : "wash and cut into bite-sized pieces";
}
const PREP_FORMS = ["whole", "minced", "sliced", "julienned", "diced", "chopped", "paste", "washed & cut", "other"];
function requiredPrepForm(ingredient, info) {
  // Recipe-specific cuts take priority. Generic suggestions ("slice or mince")
  // are intentionally NOT treated as an exact match.
  const explicit = (ingredient.prepForm || ingredient.preparation || "").toLowerCase().trim();
  if (explicit && PREP_FORMS.includes(explicit)) return explicit;
  if (info.kind !== "aggregate") return "";
  const hint = (info.hint || "").toLowerCase();
  if (/\\b(or|either)\\b/.test(hint)) return "";
  const matches = PREP_FORMS.filter(form => form !== "other" && form !== "whole" && hint.includes(form.replace(/ed$/, "")));
  return matches.length === 1 ? matches[0] : "";
}
function pantryHasPreparedForm(pantry, name, form) {
  if (!form) return false; // ambiguous recipe instruction: never silently assume a match
  return pantry.some(p => wordMatch(name.toLowerCase(), p.name.toLowerCase())
    && (p.preparedForms || []).some(f => (typeof f === "string" ? f : f.form) === form));
}
function classifyPrepIngredient(ingredient) {
  const n = ingredient.name.toLowerCase();
  if (ingredient.category === "seasoning" && PREP_AROMATIC_NAMES.some(a => n.includes(a))) {
    return { kind: "aggregate", label: `Chop ${ingredient.name.toLowerCase()}`, hint: getCutHint(ingredient.name) };
  }
  if (ingredient.category === "vegetable") {
    return { kind: "aggregate", label: `Wash & cut ${ingredient.name.toLowerCase()}`, hint: getCutHint(ingredient.name) };
  }
  if (ingredient.category === "protein") {
    if (PREP_FREEZE_PROTEIN_NAMES.some(p => n.includes(p))) {
      return { kind: "freeze", label: `Portion & freeze ${ingredient.name.toLowerCase()}` };
    }
    if (PREP_MARINATE_PROTEIN_NAMES.some(p => n.includes(p))) {
      return { kind: "marinate", label: `Marinate ${ingredient.name.toLowerCase()}` };
    }
  }
  return null;
}

const DEFAULT_PANTRY = [
  { ...ing("Rice","grain"), location: "pantry", quantity: null, unit: "" },
  { ...ing("Garlic","seasoning"), location: "pantry", quantity: null, unit: "" },
  { ...ing("Ginger","seasoning"), location: "fridge", quantity: null, unit: "" },
  { ...ing("Light soy sauce","seasoning"), location: "pantry", quantity: null, unit: "" },
  { ...ing("Dark soy sauce","seasoning"), location: "pantry", quantity: null, unit: "" },
  { ...ing("Oyster sauce","seasoning"), location: "pantry", quantity: null, unit: "" },
  { ...ing("Sesame oil","seasoning"), location: "pantry", quantity: null, unit: "" },
  { ...ing("Cooking oil","seasoning"), location: "pantry", quantity: null, unit: "" },
  { ...ing("Salt","seasoning"), location: "pantry", quantity: null, unit: "" },
  { ...ing("Sugar","seasoning"), location: "pantry", quantity: null, unit: "" },
  { ...ing("White pepper","seasoning"), location: "pantry", quantity: null, unit: "" },
  { ...ing("Cornstarch","seasoning"), location: "pantry", quantity: null, unit: "" },
].map((it, i) => ({ id: "p" + i, ...it }));


// Date helpers — everything works on plain "YYYY-MM-DD" strings so days can
// be compared and sorted with simple string comparison, and each meal in the
// plan carries its own real calendar date rather than a position relative to
// whenever Generate was last pressed. That's what lets "generate more" keep
// still-valid future days instead of wiping them.
function toDateStr(d) {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0"), day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function todayDateStr() { return toDateStr(new Date()); }
function addDaysToDateStr(dateStr, n) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + n);
  return toDateStr(dt);
}
function formatDayLabel(dateStr) {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const weekday = dt.toLocaleDateString("en-SG", { weekday: "short" });
  const dm = dt.toLocaleDateString("en-SG", { day: "2-digit", month: "short" });
  const today = todayDateStr();
  if (dateStr === today) return `Today — ${weekday}, ${dm}`;
  if (dateStr === addDaysToDateStr(today, 1)) return `Tomorrow — ${weekday}, ${dm}`;
  return `${weekday}, ${dm}`;
}

// Clusters a day's meals (main + its sides, generated back-to-back) into
// one group per meal type, so "Lunch" and "Dinner" each get their own small
// header above their dishes instead of every dish in the day reading as one
// undifferentiated stack — the exact thing that made it easy to scroll past
// a meal without registering which one it was.
function groupMealsByType(meals) {
  const groups = [];
  meals.forEach(m => {
    const last = groups[groups.length - 1];
    const key = m.mealType || "";
    if (last && last.mealType === key) last.items.push(m);
    else groups.push({ mealType: key, items: [m] });
  });
  return groups;
}

function formatQty(n) {
  if (n == null) return "";
  const r = Math.round(n * 10) / 10;
  return r % 1 === 0 ? String(r) : r.toFixed(1);
}
function scaledAmount(amount, baseServings, targetServings) {
  if (amount == null || !baseServings || !targetServings) return amount;
  return amount * (targetServings / baseServings);
}
// Cook time is always stored as a plain minutes number (see TimeInput), but
// showing "200m" everywhere defeats the point of letting someone enter it as
// hours+minutes — this renders it back out the readable way (e.g. "3h 20m",
// or just "45m" for anything under an hour) wherever a duration is shown.
function formatDuration(minutes) {
  if (minutes == null) return "";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

const CUISINES = [...new Set(MEALS.map(m => m.cuisine))];
const PROTEINS = [...new Set(MEALS.map(m => m.protein))];

const SCOPES = [
  { id: "day", label: "A day" },
  { id: "week", label: "A week" },
  { id: "month", label: "A month" },
];

const CATEGORY_ORDER = ["protein", "vegetable", "grain", "noodle", "seasoning", "dairy", "other"];
const CATEGORY_LABEL = { protein: "Protein", vegetable: "Vegetables", grain: "Grains", noodle: "Noodles", seasoning: "Seasoning", dairy: "Dairy", other: "Other" };

/* ---------------------------------------------------------------
   HOUSEHOLD PROFILE — dietary substitution engine
------------------------------------------------------------------*/
const DIET_OPTIONS = [
  { id: "halal", label: "Halal", blurb: "Pork gets swapped for a halal-friendly protein automatically." },
  { id: "vegetarian", label: "Vegetarian", blurb: "Meat and seafood get swapped for plant-based alternatives." },
  { id: "soft", label: "Soft & easy to chew", blurb: "Prioritises softer meals — good for young kids or elderly family members." },
];

// Meals that are naturally soft / low chewing effort (soups, braises, minced,
// silky tofu, steamed). Approximate tagging for the demo — a real build would
// let each recipe carry its own texture rating.
const SOFT_FRIENDLY_IDS = new Set([
  "m2","m3","m5","m6","m7","m9","m10","m12","m13","m16","m17","m18","m19",
  "m21","m22","m23","m25","m26","m27","m29","m30","m34","m35","m36",
  "m37","m39","m40",
]);

// Which meal-of-day a dish suits. Anything not listed defaults to lunch+dinner
// (most mains). A handful of dishes that are genuinely breakfast-friendly in
// Singapore (kaya-toast-adjacent, prata, congee-style, light soups) get
// breakfast added too — so a random "3 meals a day" generation won't hand you
// bibimbap at 7am.
const MEAL_TYPES_BY_ID = {
  m5: ["breakfast", "lunch", "dinner"],   // Egg Fried Rice
  m7: ["lunch", "dinner"],                // Chicken & Sweetcorn Soup
  m9: ["lunch", "dinner"],                // Bak Kut Teh
  m10: ["breakfast", "lunch", "dinner"],  // Wonton Noodle Soup
  m11: ["breakfast", "lunch", "dinner"],  // Nasi Lemak
  m13: ["lunch", "dinner"],               // Mee Goreng
  m20: ["breakfast", "lunch", "dinner"],  // Prata & Egg Curry
  m30: ["breakfast", "lunch", "dinner"],  // Miso Soup & Tofu
  m31: ["breakfast", "lunch", "dinner"],  // Salmon Onigiri
  m37: ["breakfast", "lunch", "dinner"],  // Fried Egg
  m38: ["breakfast", "lunch", "dinner"],  // Fried Luncheon Meat
};

const HALAL_FALLBACK = {
  "Pork loin": "Chicken thigh", "Pork ribs": "Chicken drumstick", "Minced pork": "Minced chicken",
  "Pork belly": "Chicken thigh", "Chinese sausage": "Chicken sausage",
};
const VEG_FALLBACK = {
  "Chicken thigh": "Firm tofu", "Chicken breast": "Tempeh", "Fried chicken wing": "Fried tofu",
  "Pork loin": "Firm tofu", "Pork ribs": "King oyster mushroom", "Pork belly": "Firm tofu",
  "Minced pork": "Minced mushroom", "Minced beef": "Plant-based mince",
  "Beef slices": "Seitan", "Beef strips": "Seitan", "Beef cubes": "Jackfruit",
  "Squid": "King oyster mushroom", "Prawns": "Tofu puffs", "Fish fillet": "Tempeh",
  "Salmon fillet": "Tofu steak", "White fish fillet": "Tempeh", "Whole fish": "Eggplant",
  "Anchovies": "Dried shiitake mushroom", "Salmon flake": "Marinated tofu flake",
};
const VEG_SAFE_PROTEINS = new Set(["vegetarian", "tofu", "egg"]);
const NAME_SUB_WORDS = ["pork", "beef", "chicken", "salmon", "prawns", "squid", "fish"];

function capitalize(w) { return w.charAt(0).toUpperCase() + w.slice(1); }

function escapeRegex(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp[m][n];
}

// Allows a small number of typo'd characters, scaled to word length — tight
// enough that short words ("rice" vs "mice") don't false-match, loose enough
// that "Spagethi" still finds "Spaghetti".
function closeEnough(w1, w2) {
  if (w1 === w2) return true;
  const maxLen = Math.max(w1.length, w2.length);
  if (maxLen < 5) return false;
  const threshold = maxLen <= 6 ? 1 : maxLen <= 10 ? 2 : 3;
  return levenshtein(w1, w2) <= threshold;
}

// Whole-word fuzzy match: "Rice" matches "Jasmine rice" or "Basmati rice",
// but "Egg" does NOT match "Eggplant" (word boundary stops that). Falls
// back to a typo-tolerant word-by-word comparison when there's no clean
// substring match, so a misspelling still finds its match.
function wordMatch(a, b) {
  const shorter = a.length <= b.length ? a : b;
  const longer = a.length <= b.length ? b : a;
  if (shorter) {
    try {
      if (new RegExp("\\b" + escapeRegex(shorter) + "\\b", "i").test(longer)) return true;
    } catch (e) {
      if (a.toLowerCase() === b.toLowerCase()) return true;
    }
  }
  const wordsA = a.split(/\s+/).filter(Boolean);
  const wordsB = b.split(/\s+/).filter(Boolean);
  for (const wa of wordsA) {
    for (const wb of wordsB) {
      if (closeEnough(wa, wb)) return true;
    }
  }
  return false;
}
function isInPantry(ingredientName, pantryList) {
  const n = ingredientName.toLowerCase();
  return pantryList.some(p => wordMatch(n, p.name.toLowerCase()));
}
function findPantryMatch(ingredientName, pantryList) {
  const n = ingredientName.toLowerCase();
  return pantryList.find(p => wordMatch(n, p.name.toLowerCase()));
}
function hasCategory(meal, category) {
  return meal.ingredients.some(i => i.category === category);
}
// "Meat" for the meat+veg pairing rule specifically excludes egg, tofu and
// vegetarian dishes — those are tagged category "protein" too, but egg/tofu
// shouldn't count as satisfying a "must have meat" check.
function hasRealMeat(meal) {
  return !["egg", "tofu", "vegetarian"].includes(meal.protein);
}
// Picks a standalone side dish for pairing, preferring one that shares the
// main dish's cuisine (a Japanese main gets a Japanese side, not a Chinese
// one) so the two dishes on the plate actually make sense together. Falls
// back to any cuisine only when nothing in that cuisine is available.
function pickMatchingSide(sideBase, cuisine) {
  const matched = sideBase.filter(m => m.cuisine === cuisine);
  const pool = matched.length ? matched : sideBase;
  return pool[Math.floor(Math.random() * pool.length)];
}
// A rich, sauce/gravy-heavy or slow-cooked main is already filling on its
// own, so a big household wanting "4 to 6 dishes" would reasonably want
// fewer variety sides next to a curry than next to something lighter like a
// stir-fry. Rather than tagging every dish by hand, this reads it off the
// name (curry, rendang, laksa...) or a genuinely rich ingredient like
// coconut milk — good enough for steering the dish count without needing a
// whole new field on every recipe.
const HEAVY_DISH_NAME_KEYWORDS = [
  "curry", "rendang", "laksa", "bak kut teh", "stew", "braised", "gulai", "korma", "masak",
];
function isHeavyDish(meal) {
  const n = meal.name.toLowerCase();
  if (HEAVY_DISH_NAME_KEYWORDS.some(k => n.includes(k))) return true;
  return meal.ingredients.some(i => i.name.toLowerCase().includes("coconut milk"));
}

// A complete bowl/plate should not get an arbitrary extra side just to meet
// a numerical dish target. This also covers future library recipes by name.
const ONE_DISH_KEYWORDS = [
  "laksa", "fried rice", "hor fun", "mee goreng", "noodle soup",
  "nasi lemak", "bibimbap", "donburi", "onigiri", "curry rice",
  "claypot chicken rice", "prata & egg curry", "katsu curry", "japanese curry", "chicken rice", "hainanese rice", "biryani", "briyani", "pasta", "spaghetti", "risotto", "rice bowl", "poke bowl", "soba", "udon", "ramen",
];
function isOneDishMeal(meal) {
  if (meal.oneDish === true) return true; // personal/community recipe override
  if (meal.oneDish === false) return false;
  const name = meal.name.toLowerCase();
  return ONE_DISH_KEYWORDS.some(keyword => name.includes(keyword));
}

function renameForSwap(name, replacementWord) {
  for (const w of NAME_SUB_WORDS) {
    const re = new RegExp("\\b" + w + "\\b", "i");
    if (re.test(name)) return name.replace(re, capitalize(replacementWord));
  }
  return name;
}

// Applies a household's dietary needs to a single meal: swaps ingredients,
// updates the protein tag, and (when the dish name says the old protein
// out loud) renames it — e.g. "Sweet & Sour Pork" -> "Sweet & Sour Chicken".
function adaptMealForDiets(meal, diets) {
  let m = { ...meal, ingredients: meal.ingredients.map(i => ({ ...i })) };
  const notes = [];

  if (diets.includes("halal") && m.protein === "pork") {
    m.ingredients = m.ingredients.map(i =>
      i.category === "protein" ? { ...i, name: HALAL_FALLBACK[i.name] || "Chicken thigh" } : i
    );
    m.name = renameForSwap(m.name, "chicken");
    m.protein = "chicken";
    notes.push("Swapped pork → chicken for halal");
  }

  if (diets.includes("vegetarian") && !VEG_SAFE_PROTEINS.has(m.protein)) {
    m.ingredients = m.ingredients.map(i =>
      i.category === "protein" ? { ...i, name: VEG_FALLBACK[i.name] || "Firm tofu" } : i
    );
    m.name = renameForSwap(m.name, "tofu");
    m.protein = "vegetarian";
    notes.push(`Swapped ${meal.protein} → plant-based for vegetarian`);
  }

  m.soft = m.soft !== undefined ? m.soft : SOFT_FRIENDLY_IDS.has(m.id);
  m.adapted = notes.length > 0;
  m.adaptNotes = notes;
  return m;
}

// Swaps out (or drops) individual ingredients the household dislikes, rather
// than excluding the whole dish — e.g. curry fish head keeps its place in the
// rotation, it just loses the okra (or gets it swapped for something else).
function applyDislikeSubs(meal, dislikes) {
  if (!dislikes.length) return meal;
  let changed = false;
  const notes = [...(meal.adaptNotes || [])];
  const ingredients = meal.ingredients
    .map(i => {
      const hit = dislikes.find(d => d.name && wordMatch(d.name.toLowerCase(), i.name.toLowerCase()));
      if (!hit) return i;
      changed = true;
      if (hit.substitute) {
        notes.push(`Swapped ${i.name} → ${hit.substitute} (your preference)`);
        return { ...i, name: hit.substitute };
      }
      notes.push(`Left out ${i.name} (not eaten in your household)`);
      return null;
    })
    .filter(Boolean);
  if (!changed) return meal;
  return { ...meal, ingredients, adapted: true, adaptNotes: notes };
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ---------------------------------------------------------------
   SMALL UI PRIMITIVES
------------------------------------------------------------------*/
function Chip({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        fontFamily: FONT_BODY,
        border: `1px solid ${active ? C.jade700 : C.line}`,
        background: active ? C.jade700 : "transparent",
        color: active ? C.paper : C.inkSoft,
        borderRadius: 999,
        padding: "6px 12px",
        fontSize: 12.5,
        fontWeight: 600,
        whiteSpace: "nowrap",
        transition: "all .15s",
      }}
    >
      {children}
    </button>
  );
}

function CategoryDot({ category }) {
  return (
    <span
      style={{
        display: "inline-block",
        width: 7,
        height: 7,
        borderRadius: 999,
        background: CATEGORY_DOT[category] || C.inkSoft,
        marginRight: 6,
        flexShrink: 0,
      }}
    />
  );
}

/* ---------------------------------------------------------------
   FIRST-LAUNCH GUIDED TOUR
   A one-time walkthrough for someone who's just installed the app.
   Each step names the tab it belongs to (or null for the welcome/
   closing steps, which don't move the screen underneath); the tour
   switches the real `tab` state to match as the person steps
   through, so what they see behind the card is the actual screen,
   not a mockup. Skippable at any point; replayable later from
   Household → Help.
------------------------------------------------------------------*/
const TOUR_STEPS = [
  {
    tab: null,
    icon: Sparkles,
    title: "Welcome to Plan My Meals 🍚",
    body: "A quick 1-minute tour of how the app fits together. Tap Skip anytime; you can replay this later from Household → Help.",
  },
  {
    tab: "household",
    icon: Users,
    title: "1. Set up your household first",
    body: "Family size, dietary needs (halal, vegetarian, soft food for elderly), and disliked ingredients all live here. Do this before generating a plan — every plan you make afterwards automatically swaps or filters dishes to fit what you set here.",
  },
  {
    tab: "pantry",
    icon: Package,
    title: "2. Log what's already in your kitchen",
    body: "Add what you already have — including anything you just bought on discount. When you generate a plan, it's built around what's already logged here first, and the shopping list only shows what's actually still missing.",
  },
  {
    tab: "import",
    icon: BookmarkPlus,
    title: "3. Add your own recipes",
    body: "Bring in family recipes the app doesn't know yet. A recipe can also be marked as a component (like a sauce or condiment you prep ahead) — those get used inside other dishes instead of showing up as a meal on their own.",
  },
  {
    tab: "generate",
    icon: ChefHat,
    title: "4. Generate a plan",
    body: "Tap Generate for a day or a week — meals come out already adapted to your household's dietary settings and built around whatever's already in your Kitchen. Don't like a dish? Tap the refresh icon on it to search for something else or hit Surprise me. Unexpected guest? Use \"+ Add a dish\" — it even has one-off filters like No pork or Vegetarian only, just for that guest.",
  },
  {
    tab: null,
    icon: Sparkles,
    title: "Works in either order — shop first, or plan first",
    body: "You've now seen both halves, so here's the point: saw a good discount and bought a bunch of chicken? Log it in Kitchen like you just saw, then Generate builds a plan around what you already have. Prefer to plan ahead instead? Generate first, the way you just did, and the next step hands you a shopping list of exactly what's missing. Same app, either direction — whichever fits how you actually shop that week.",
  },
  {
    tab: "list",
    icon: ShoppingCart,
    title: "5. Shop with the auto-built list",
    body: "Whichever order you worked in, this tab turns your plan into a shopping list — what's needed minus what's already in your kitchen. Check things off as you buy them, and next time, log a good discount into Kitchen before you Generate to plan around it.",
  },
  {
    tab: null,
    icon: Sparkles,
    title: "That's it!",
    body: "You're ready to go. If you ever want this walkthrough again, it's under Household → Help → Replay the walkthrough.",
  },
];

function OnboardingTour({ step, onNext, onBack, onSkip }) {
  const s = TOUR_STEPS[step];
  const Icon = s.icon;
  const isFirst = step === 0;
  const isLast = step === TOUR_STEPS.length - 1;
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 60, display: "flex", flexDirection: "column",
      justifyContent: "flex-end", background: "rgba(20, 30, 22, 0.55)", padding: 16,
    }}>
      <div style={{
        background: C.paper, borderRadius: 18, padding: "20px 20px 16px",
        boxShadow: "0 -8px 30px rgba(0,0,0,0.35)", border: `1px solid ${C.jade700}`,
        width: "100%", maxWidth: 528, margin: "0 auto",
      }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10 }}>
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "center", width: 34, height: 34,
            borderRadius: 10, background: "#EAF3EE", flexShrink: 0,
          }}>
            <Icon size={17} color={C.jade700} />
          </div>
          <button onClick={onSkip} aria-label="Skip walkthrough" style={{ color: C.inkSoft, padding: 4 }}>
            <X size={16} />
          </button>
        </div>
        <h3 style={{ fontFamily: FONT_DISPLAY, fontSize: 16.5, fontWeight: 700, color: C.ink, margin: "0 0 6px" }}>
          {s.title}
        </h3>
        <p style={{ fontSize: 12.5, color: C.inkSoft, lineHeight: 1.5, margin: "0 0 16px" }}>
          {s.body}
        </p>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: 5 }}>
            {TOUR_STEPS.map((_, i) => (
              <span key={i} style={{
                width: 6, height: 6, borderRadius: 999,
                background: i === step ? C.jade700 : C.line,
              }} />
            ))}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {!isFirst && (
              <button onClick={onBack} style={{
                color: C.jade700, fontFamily: FONT_BODY, fontWeight: 700, fontSize: 12.5, padding: "9px 12px",
              }}>Back</button>
            )}
            <button
              onClick={isLast ? onSkip : onNext}
              style={{
                background: C.jade700, color: "#fff", border: "none", borderRadius: 10,
                padding: "9px 16px", fontFamily: FONT_BODY, fontWeight: 700, fontSize: 12.5,
              }}
            >
              {isLast ? "Done" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------
   MAIN APP
------------------------------------------------------------------*/
export default function MakanLedger() {
  // The tab survives a restart of the app (a family member's change arriving
  // restarts it), so you stay on the screen you were looking at.
  const [tab, setTab] = useState(() => {
    try {
      const saved = sessionStorage.getItem("pmm-tab");
      return saved === "generate" ? "week" : (saved && ["home", "week", "prep", "me", "manual", "list", "pantry", "library", "import", "household"].includes(saved) ? saved : "home");
    } catch (e) { return "home"; }
  });
  const [moreOpen, setMoreOpen] = useState(false);
  const [rescueOpen, setRescueOpen] = useState(false);
  const [rescueText, setRescueText] = useState("");
  useEffect(() => { try { sessionStorage.setItem("pmm-tab", tab); } catch (e) { /* ignore */ } }, [tab]);
  const [ready, setReady] = useState(false);
  // Desktop side tabs only appear once the app (below the story section) is in view.
  const [atApp, setAtApp] = useState(false);
  useEffect(() => {
    const el = document.getElementById("app");
    if (!el || typeof IntersectionObserver === "undefined") { setAtApp(true); return; }
    const io = new IntersectionObserver(([e]) => setAtApp(e.isIntersecting), { rootMargin: "0px 0px -70% 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const [pantry, setPantry] = useState(DEFAULT_PANTRY);
  const [myRecipes, setMyRecipes] = useState([]);
  const [household, setHousehold] = useState({ adults: 2, kids: 0, elderly: 0, dishesPerMealMin: 2, dishesPerMealMax: 2, diets: [], preferredCuisines: [], preferredProteins: [], dislikedIngredients: [] });
  const [plan, setPlan] = useState([]);
  const [justGeneratedWeek, setJustGeneratedWeek] = useState(false);
  const [checkedItems, setCheckedItems] = useState({});
  const [extraItems, setExtraItems] = useState([]);
  const [prepChecked, setPrepChecked] = useState({});

  const [scope, setScope] = useState("day");
  const [mealSlots, setMealSlots] = useState(["breakfast", "lunch", "dinner"]);
  // How many people each meal slot is cooked for. null = the whole household.
  // Lets lunch be 2 (just the people at home) and dinner be 4 or 5 (everyone's
  // back) — stamped onto each dish when it's generated, then adjustable per
  // meal afterwards if plans change.
  const [slotPax, setSlotPax] = useState({ breakfast: null, lunch: null, dinner: null });
  const [generateNote, setGenerateNote] = useState("");
  const [skippedDays, setSkippedDays] = useState([]);

  const [newPantryName, setNewPantryName] = useState("");
  const [newPantryCategory, setNewPantryCategory] = useState("seasoning");
  const [newPantryLocation, setNewPantryLocation] = useState("pantry");
  const [newPantryQuantity, setNewPantryQuantity] = useState("");
  const [newPantryUnit, setNewPantryUnit] = useState("");
  const [newPantryUseSoon, setNewPantryUseSoon] = useState(false);

  // Cross-device sync settings — a Firebase project ID plus a shared "sync
  // code" you make up, entered the same on both phones. Not auto-synced:
  // Push and Pull are separate explicit actions (see syncClient.js for why).
  const [syncSettings, setSyncSettings] = useState({ projectId: "", code: "", lastPushedAt: null, lastPulledAt: null });
  const [syncStatus, setSyncStatus] = useState({ state: "idle", message: "" }); // idle | working | error

  // First-launch guided tour — shown once automatically, replayable anytime
  // from Household → Help. `tourStep` also drives which tab is showing
  // behind the tour card (see the effect below), so each step introduces
  // the actual screen it's talking about.
  const [showTour, setShowTour] = useState(false);
  const [tourStep, setTourStep] = useState(0);

  // Whether the Weekend prep card is expanded. Previously this was hardcoded
  // open on every render, which meant React re-forced it open on every
  // re-render — including just switching tabs and back — silently undoing
  // anyone who'd collapsed it. Now it's real state, defaults open, and stays
  // wherever the person leaves it for the rest of this app session.
  const [prepCardOpen, setPrepCardOpen] = useState(true);

  // The recipe being typed into "Add recipe" — this used to live inside
  // ImportScreen's own local state, which meant switching to any other tab
  // and back unmounted that screen and silently threw away everything typed
  // so far. Hoisted up here (and persisted) so it survives both a tab
  // switch and the app being closed mid-entry.
  const [recipeDraft, setRecipeDraft] = useState(null);
  // Shared recipe library (read by everyone, edited only by the admin account).
  const [cloudUser, setCloudUser] = useState(() => cloudSnapshot().user);
  useEffect(() => cloudSubscribe(s => setCloudUser(s.user)), []);
  const isAdmin = isAdminUser(cloudUser);
  const [library, setLibrary] = useState({ items: [], status: "idle", error: "" }); // idle | loading | ready | error
  const [libraryEdit, setLibraryEdit] = useState(false);      // true while the Add-recipe form is publishing to the library
  const [libraryIntent, setLibraryIntent] = useState(null);   // { recipe? } — tells the form to open
  const refreshLibrary = React.useCallback(async () => {
    setLibrary(l => ({ ...l, status: "loading", error: "" }));
    try { const items = await loadLibrary(); setLibrary({ items, status: "ready", error: "" }); }
    catch (e) { setLibrary(l => ({ ...l, status: "error", error: "Couldn't load the library. Check your connection and try again." })); }
  }, []);
  useEffect(() => { if ((tab === "library" || (tab === "admin" && isAdmin)) && library.status === "idle") refreshLibrary(); }, [tab, isAdmin, library.status, refreshLibrary]);

  // Lightweight toast/snackbar — the one place actions like "fix this meal",
  // "eat later instead", or a pantry merge that couldn't combine cleanly get
  // confirmed on-screen, right where the person tapped, instead of only
  // showing up as a note somewhere else in the app. `undo` is optional; when
  // present it puts an Undo button on the toast that restores exactly the
  // state captured right before the action ran.
  const [toast, setToast] = useState(null); // { message, undo? }
  const toastTimerRef = useRef(null);
  function showToast(message, undo) {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ message, undo: undo || null });
    toastTimerRef.current = setTimeout(() => setToast(null), 5000);
  }
  function dismissToast() {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast(null);
  }

  /* ---- load persisted state ---- */
  useEffect(() => {
    (async () => {
      try {
        const p = await window.storage.get("pantry-items");
        if (p && p.value) setPantry(JSON.parse(p.value));
      } catch (e) { /* no saved pantry yet, use defaults */ }
      try {
        const sp = await window.storage.get("slot-pax");
        if (sp && sp.value) setSlotPax(prev => ({ ...prev, ...JSON.parse(sp.value) }));
      } catch (e) { /* no saved headcounts yet */ }
      try {
        const r = await window.storage.get("my-recipes");
        if (r && r.value) setMyRecipes(JSON.parse(r.value));
      } catch (e) { /* no saved recipes yet */ }
      try {
        const h = await window.storage.get("household-profile");
        if (h && h.value) {
          const parsed = JSON.parse(h.value);
          setHousehold(prev => ({
            ...prev,
            ...parsed,
            // Old saves only had a single "dishesPerMeal" number — read that
            // as both ends of the range so nothing changes for anyone who
            // hasn't touched the new min/max controls yet.
            dishesPerMealMin: parsed.dishesPerMealMin ?? parsed.dishesPerMeal ?? 2,
            dishesPerMealMax: parsed.dishesPerMealMax ?? parsed.dishesPerMeal ?? 2,
            diets: parsed.diets || [],
            preferredCuisines: parsed.preferredCuisines || [],
            preferredProteins: parsed.preferredProteins || [],
            dislikedIngredients: (parsed.dislikedIngredients || []).map(d =>
              typeof d === "string" ? { id: "dis" + Math.random().toString(36).slice(2), name: d, substitute: "" } : d
            ),
          }));
        }
      } catch (e) { /* no saved household profile yet */ }
      try {
        const s = await window.storage.get("plan-state");
        if (s && s.value) {
          const parsed = JSON.parse(s.value);
          setPlan(parsed.plan || []);
          setCheckedItems(parsed.checkedItems || {});
          setExtraItems(parsed.extraItems || []);
          setSkippedDays(parsed.skippedDays || []);
          setPrepChecked(parsed.prepChecked || {});
        }
      } catch (e) { /* no saved plan yet */ }
      try {
        const sy = await window.storage.get("sync-settings");
        if (sy && sy.value) setSyncSettings(prev => ({ ...prev, ...JSON.parse(sy.value) }));
      } catch (e) { /* no saved sync settings yet */ }
      try {
        const d = await window.storage.get("recipe-draft");
        if (d && d.value) setRecipeDraft(JSON.parse(d.value));
      } catch (e) { /* no in-progress draft yet */ }
      try {
        const seen = await window.storage.get("onboarding-seen");
        if (!seen || !seen.value) setShowTour(true);
      } catch (e) { setShowTour(true); }
      setReady(true);
      // The native splash (see capacitor.config.json — launchAutoHide is off)
      // stays up until this fires, so people see the branded splash instead
      // of a flash of empty defaults while everything above loads. Wrapped
      // in try/catch since this is a no-op outside the Android app.
      try { SplashScreen.hide(); } catch (e) { /* not running under Capacitor */ }
    })();
  }, []);

  // Ads (ads build only — a no-op in the no-ads build, see src/ads.js) get
  // loaded ahead of time here, then shown by showInterstitialAd() right
  // after Generate/Redo finishes building a plan.
  useEffect(() => { initAds(); }, []);

  // Keep the real screen behind the tour card in sync with whichever step
  // is showing, so e.g. step 2 ("Log what's already in your kitchen")
  // actually has the Kitchen tab open underneath it.
  useEffect(() => {
    if (!showTour) return;
    const stepTab = TOUR_STEPS[tourStep]?.tab;
    if (stepTab) setTab(stepTab);
  }, [showTour, tourStep]);

  function finishTour() {
    setShowTour(false);
    window.storage.set("onboarding-seen", "1").catch(() => {});
  }
  function restartTour() {
    setTourStep(0);
    setShowTour(true);
  }

  /* ---- persist on change ---- */
  useEffect(() => {
    if (!ready) return;
    window.storage.set("slot-pax", JSON.stringify(slotPax)).catch(() => {});
  }, [slotPax, ready]);
  useEffect(() => {
    if (!ready) return;
    window.storage.set("pantry-items", JSON.stringify(pantry)).catch(() => {});
  }, [pantry, ready]);

  useEffect(() => {
    if (!ready) return;
    window.storage.set("my-recipes", JSON.stringify(myRecipes)).catch(() => {});
  }, [myRecipes, ready]);

  useEffect(() => {
    if (!ready) return;
    window.storage.set("household-profile", JSON.stringify(household)).catch(() => {});
  }, [household, ready]);

  useEffect(() => {
    if (!ready) return;
    window.storage.set("plan-state", JSON.stringify({ plan, checkedItems, extraItems, skippedDays, prepChecked })).catch(() => {});
  }, [plan, checkedItems, extraItems, skippedDays, prepChecked, ready]);

  useEffect(() => {
    if (!ready) return;
    window.storage.set("sync-settings", JSON.stringify(syncSettings)).catch(() => {});
  }, [syncSettings, ready]);

  // Debounced: a recipe draft can carry a compressed photo (tens of KB as
  // base64), and writing that to storage on every single keystroke was
  // freezing typing on real devices — localStorage writes are synchronous
  // and blocking, so rewriting a photo-sized string per character made
  // ingredient fields feel like they'd stopped accepting input entirely.
  // Waiting for a short pause in typing before actually saving fixes that
  // without changing when the draft is considered "saved enough" to survive
  // a tab switch or the app closing (see the earlier fix for that).
  const draftSaveTimerRef = useRef(null);
  useEffect(() => {
    if (!ready) return;
    if (draftSaveTimerRef.current) clearTimeout(draftSaveTimerRef.current);
    draftSaveTimerRef.current = setTimeout(() => {
      if (recipeDraft) {
        window.storage.set("recipe-draft", JSON.stringify(recipeDraft)).catch(() => {});
      } else if (typeof window.storage.remove === "function") {
        window.storage.remove("recipe-draft").catch(() => {});
      } else {
        window.storage.set("recipe-draft", "").catch(() => {});
      }
    }, 500);
    return () => clearTimeout(draftSaveTimerRef.current);
  }, [recipeDraft, ready]);

  function setSyncField(field, value) {
    setSyncSettings(prev => ({ ...prev, [field]: value }));
  }

  // Uploads everything this device has (pantry, recipes, household profile,
  // the current plan) as one snapshot, overwriting whatever was there
  // before for this project ID + code. This is the "make the other device
  // match this one" direction.
  async function handlePushToCloud() {
    if (!syncSettings.projectId.trim() || !syncSettings.code.trim()) {
      showToast("Enter a Firebase project ID and a sync code first");
      return;
    }
    setSyncStatus({ state: "working", message: "" });
    try {
      const payload = { pantry, myRecipes, household, plan, checkedItems, extraItems, skippedDays, prepChecked };
      const { updatedAt } = await pushState(syncSettings.projectId.trim(), syncSettings.code.trim(), payload);
      setSyncSettings(prev => ({ ...prev, lastPushedAt: updatedAt }));
      setSyncStatus({ state: "idle", message: "" });
      showToast("Pushed to cloud — this device's data is now what the other device will pull");
    } catch (e) {
      setSyncStatus({ state: "error", message: String(e.message || e) });
    }
  }

  // Downloads the shared snapshot and overwrites everything on THIS device
  // with it — a destructive action for the device pulling, so it snapshots
  // current state first and offers Undo, same as any other destructive
  // action in this app.
  async function handlePullFromCloud() {
    if (!syncSettings.projectId.trim() || !syncSettings.code.trim()) {
      showToast("Enter a Firebase project ID and a sync code first");
      return;
    }
    setSyncStatus({ state: "working", message: "" });
    try {
      const result = await pullState(syncSettings.projectId.trim(), syncSettings.code.trim());
      if (!result) {
        setSyncStatus({ state: "idle", message: "" });
        showToast("Nothing's been pushed yet for this project ID + code");
        return;
      }
      const prevSnapshot = { pantry, myRecipes, household, plan, checkedItems, extraItems, skippedDays, prepChecked };
      const p = result.payload;
      setPantry(p.pantry || []);
      setMyRecipes(p.myRecipes || []);
      setHousehold(prev => ({ ...prev, ...(p.household || {}) }));
      setPlan(p.plan || []);
      setCheckedItems(p.checkedItems || {});
      setExtraItems(p.extraItems || []);
      setSkippedDays(p.skippedDays || []);
      setPrepChecked(p.prepChecked || {});
      setSyncSettings(prev => ({ ...prev, lastPulledAt: result.updatedAt }));
      setSyncStatus({ state: "idle", message: "" });
      showToast("Pulled from cloud — this device now matches the other one", () => {
        setPantry(prevSnapshot.pantry);
        setMyRecipes(prevSnapshot.myRecipes);
        setHousehold(prevSnapshot.household);
        setPlan(prevSnapshot.plan);
        setCheckedItems(prevSnapshot.checkedItems);
        setExtraItems(prevSnapshot.extraItems);
        setSkippedDays(prevSnapshot.skippedDays);
        setPrepChecked(prevSnapshot.prepChecked);
      });
    } catch (e) {
      setSyncStatus({ state: "error", message: String(e.message || e) });
    }
  }

  const toggleFilter = (setFn) => (value) =>
    setFn(prev => prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]);

  function toggleDiet(value) {
    setHousehold(prev => ({
      ...prev,
      diets: prev.diets.includes(value) ? prev.diets.filter(d => d !== value) : [...prev.diets, value],
    }));
  }
  function setHouseholdCount(field, value) {
    setHousehold(prev => ({ ...prev, [field]: value }));
  }
  // Keeps min <= max automatically — dragging the minimum above the current
  // maximum (or the maximum below the current minimum) pulls the other end
  // along instead of leaving an invalid range sitting in state.
  function setDishesPerMealRange(which, value) {
    setHousehold(prev => {
      if (which === "min") {
        return { ...prev, dishesPerMealMin: value, dishesPerMealMax: Math.max(value, prev.dishesPerMealMax) };
      }
      return { ...prev, dishesPerMealMax: value, dishesPerMealMin: Math.min(value, prev.dishesPerMealMin) };
    });
  }
  function toggleHouseholdList(field, value) {
    setHousehold(prev => ({
      ...prev,
      [field]: prev[field].includes(value) ? prev[field].filter(v => v !== value) : [...prev[field], value],
    }));
  }
  function addDislike(name, substitute) {
    const n = name.trim();
    if (!n) return;
    setHousehold(prev => prev.dislikedIngredients.some(d => d.name.toLowerCase() === n.toLowerCase())
      ? prev
      : { ...prev, dislikedIngredients: [...prev.dislikedIngredients, { id: "dis" + Date.now(), name: n, substitute: (substitute || "").trim() }] });
  }
  function removeDislike(id) {
    setHousehold(prev => ({ ...prev, dislikedIngredients: prev.dislikedIngredients.filter(d => d.id !== id) }));
  }
  function toggleMealSlot(type) {
    setMealSlots(prev => {
      if (prev.includes(type)) {
        if (prev.length === 1) return prev;
        return prev.filter(t => t !== type);
      }
      return [...prev, type];
    });
  }

  function withDefaults(meal) {
    return {
      ...meal,
      soft: meal.soft !== undefined ? meal.soft : SOFT_FRIENDLY_IDS.has(meal.id),
      mealTypes: meal.mealTypes && meal.mealTypes.length ? meal.mealTypes : (MEAL_TYPES_BY_ID[meal.id] || ["lunch", "dinner"]),
    };
  }

  const getPool = useCallback(() => {
    let pool = [...MEALS, ...myRecipes.map(r => ({ ...r, custom: true }))]
      // A component recipe (sambal, curry roux, a spice paste — something
      // eaten as part of other dishes, never on its own) is never a
      // candidate for a meal slot or a side pairing. It only ever gets
      // pulled in by another recipe's ingredient list linking to it —
      // never picked here, so it can't accidentally end up as "dinner".
      .filter(m => !m.isComponent)
      .map(withDefaults)
      .map(m => adaptMealForDiets(m, household.diets))
      .map(m => applyDislikeSubs(m, household.dislikedIngredients));
    let softFallback = false;
    if (household.diets.includes("soft")) {
      const softPool = pool.filter(m => m.soft);
      if (softPool.length) pool = softPool; else softFallback = true;
    }
    // Cuisine/protein preferences only narrow the built-in idea pool — a recipe
    // you deliberately saved from a link is something you already chose, so it
    // never gets filtered out by these.
    if (household.preferredCuisines.length) pool = pool.filter(m => m.custom || household.preferredCuisines.includes(m.cuisine));
    if (household.preferredProteins.length) pool = pool.filter(m => m.custom || household.preferredProteins.includes(m.protein));

    return { pool, softFallback };
  }, [myRecipes, household]);

  // The same pool getPool() draws from, sorted alphabetically, for the
  // "pick a specific dish" control — for when you already know what you
  // want to cook and don't want to reroll Regenerate until it turns up.
  const pickableMeals = useMemo(() => {
    const { pool } = getPool();
    return [...pool].sort((a, b) => a.name.localeCompare(b.name));
  }, [getPool]);

  // Same list, but skipping the halal/vegetarian ingredient-and-name
  // substitution — the true, unadapted recipes, only surfaced through the
  // "show original recipes" toggle in a meal card's picker (e.g. the real
  // pork ramen, not the chicken swap, for whoever in the household
  // deliberately wants it). Dislikes and cuisine/protein taste preferences
  // still apply here — those aren't the restriction being bypassed.
  const rawPickableMeals = useMemo(() => {
    let pool = [...MEALS, ...myRecipes.map(r => ({ ...r, custom: true }))]
      .filter(m => !m.isComponent)
      .map(withDefaults)
      .map(m => applyDislikeSubs(m, household.dislikedIngredients));
    if (household.preferredCuisines.length) pool = pool.filter(m => m.custom || household.preferredCuisines.includes(m.cuisine));
    if (household.preferredProteins.length) pool = pool.filter(m => m.custom || household.preferredProteins.includes(m.protein));
    return [...pool].sort((a, b) => a.name.localeCompare(b.name));
  }, [myRecipes, household]);

  // Builds a day-by-day plan where each day's slots are the meal types the
  // person actually asked for (breakfast/lunch/dinner), picking only from
  // meals tagged suitable for that slot — so breakfast never gets bibimbap.
  // Each slot type gets its own shuffled queue, dealt without replacement, so
  // a whole week won't repeat a dish until every option for that slot has
  // had a turn (only cycling back once the pool for that slot is smaller
  // than the number of days requested).
  // Builds each meal-type's picks in two passes: first draining a shuffled
  // queue of meals that use up something flagged "use soon" in the kitchen,
  // then falling back to the normal shuffled pool once those run out. This
  // is what makes "add to kitchen" actually mean something at generation
  // time, without needing a separate one-off filter step.
  function buildDaySlotsPlan(pool, daysCount, slots, startDateStr, kitchen, dishRange) {
    // dishRange is {min, max} — a big family eating family-style might want
    // "4 to 6 dishes on the table", but not every main deserves the full 6:
    // a rich, already-filling dish (curry, rendang...) aims for the low end
    // of that range, and anything lighter aims for the high end. A single
    // fixed number (min === max, the old behaviour) just makes every meal
    // hit that same count regardless.
    const minCount = Math.max(1, dishRange?.min ?? dishRange ?? 2);
    const maxCount = Math.max(minCount, dishRange?.max ?? dishRange ?? 2);
    const stocked = (kitchen || []).filter(k => k.name && (k.qty == null || Number(k.qty) > 0));
    const useSoonItems = stocked.filter(k => k.useSoon);
    const usesKitchenStock = (meal) => useSoonItems.some(k => meal.ingredients.some(i => wordMatch(i.name.toLowerCase(), k.name.toLowerCase())));
    const stockScore = meal => meal.ingredients.reduce((score, ingredient) => score + stocked.reduce((n, item) =>
      n + (wordMatch(ingredient.name.toLowerCase(), item.name.toLowerCase()) ? (item.useSoon ? 6 : 2) : 0), 0), 0);
    const kitchenFirstOrder = list => shuffle(list).sort((a,b) => stockScore(a) - stockScore(b));

    const results = [];
    if (!pool.some(m => !m.side && !m.isComponent)) return { meals: [], shortSlots: daysCount * slots.length, worstShortfall: maxCount };
    let shortSlots = 0; // meal slots that couldn't reach the requested dish count — dish bank ran dry, not a bug
    let worstShortfall = 0;
    const queues = {};
    slots.forEach(type => {
      const slotPool = pool.filter(m => !m.isComponent && m.mealTypes.includes(type));
      const sub = slotPool.filter(m => !m.side);
      const base = sub.length ? sub : pool.filter(m => !m.side && !m.isComponent);
      const priority = useSoonItems.length ? base.filter(usesKitchenStock) : [];
      const rest = useSoonItems.length ? base.filter(m => !usesKitchenStock(m)) : base;
      queues[type] = {
        base, restBase: rest.length ? rest : base,
        priorityQueue: kitchenFirstOrder(priority), restQueue: kitchenFirstOrder(rest.length ? rest : base),
        // Side-dish pools for pairing: a pure vegetable side (no protein
        // ingredient) to pair with a meat-only main, or vice versa — so a
        // meal can be one all-in-one dish, or two simple ones together.
        // The meat side pool specifically excludes egg/tofu/vegetarian —
        // those don't count as "meat" even though they're tagged protein.
        // Restricted to dishes explicitly marked `side: true` — otherwise
        // any full composite dish that happens to be missing one food group
        // (e.g. Dal Tadka has no vegetable, Butter Chicken has no vegetable
        // either) could get pulled in as someone else's "side", stacking
        // two full rice-and-all dinners onto one slot instead of one light
        // pairing.
        vegSideBase: slotPool.filter(m => m.side && hasCategory(m, "vegetable") && !hasCategory(m, "protein")),
        proteinSideBase: slotPool.filter(m => m.side && hasRealMeat(m) && !hasCategory(m, "vegetable")),
      };
    });
    for (let d = 0; d < daysCount; d++) {
      const dateStr = addDaysToDateStr(startDateStr, d);
      for (const type of slots) {
        const q = queues[type];
        let choice;
        if (q.priorityQueue.length > 0) {
          choice = q.priorityQueue.pop();
        } else {
          if (q.restQueue.length === 0) q.restQueue = kitchenFirstOrder(q.restBase);
          choice = q.restQueue.pop();
        }
        const uidBase = choice.id + "-" + dateStr + "-" + type + "-" + Math.random().toString(36).slice(2, 7);
        results.push({ ...choice, uid: uidBase, date: dateStr, mealType: type });

        // Round the meal out to however many dishes this household wants on
        // the table — the low end of the range for a main that's already
        // rich/filling on its own (curry, rendang...), the high end for
        // anything lighter, so "4 to 6 dishes" doesn't mean 6 next to every
        // single main regardless of how heavy it already is. Meat and
        // vegetable are filled first if the main dish is missing either —
        // meat takes priority on the rare dish missing both, since "no meat
        // at all" is the complaint that matters most. Once both food groups
        // are covered, any further dishes are bonus variety sides. Every
        // side is picked from dishes matching the main's own cuisine where
        // possible, and never repeats a dish already used in this same
        // meal. Stops early if the side pool runs out before reaching the
        // target — better a short meal than a repeated dish.
        const standalone = isOneDishMeal(choice);
        const targetCount = standalone ? 1 : Math.min(2, (isHeavyDish(choice) ? minCount : maxCount));
        // Egg/tofu are valid mains; don't automatically add a second protein
        // to fried egg when what the household actually wants is greens.
        let needsMeat = !hasRealMeat(choice) && !["egg", "tofu", "vegetarian"].includes(choice.protein);
        let needsVeg = !hasCategory(choice, "vegetable");
        const usedSideIds = new Set();
        let dishCount = 1;
        // A main that's already a complete one-pot meal on its own (real
        // meat AND vegetable together — Bak Kut Teh, Mee Goreng, a rice
        // bowl) doesn't actually need padding out to hit the household's
        // usual dish count; the bonus branch below would just be adding
        // variety, not filling a gap. So it gets a real chance to stay a
        // single dish, which is the flexibility a fixed "dishes per meal"
        // setting would otherwise flatten out. An incomplete main (missing
        // meat or veg) always gets filled in — that's covering a real gap,
        // not optional variety, so it isn't left to chance.
        const isCompleteOnItsOwn = !needsMeat && !needsVeg;
        const skipBonusPadding = standalone || isCompleteOnItsOwn;
        while (!skipBonusPadding && dishCount < targetCount) {
          let side = null, filledKind = null;
          if (needsMeat) {
            const candidates = q.proteinSideBase.filter(m => !usedSideIds.has(m.id));
            if (candidates.length) { side = pickMatchingSide(candidates, choice.cuisine); filledKind = "meat"; }
          }
          if (!side && needsVeg) {
            const candidates = q.vegSideBase.filter(m => !usedSideIds.has(m.id));
            if (candidates.length) { side = pickMatchingSide(candidates, choice.cuisine); filledKind = "veg"; }
          }
          // No arbitrary bonus side: if the meal is complete, stop rather than pairing two dinners.
          if (!side) break;
          usedSideIds.add(side.id);
          if (filledKind === "meat") needsMeat = false;
          if (filledKind === "veg") needsVeg = false;
          dishCount++;
          results.push({ ...side, uid: uidBase + "-side-" + dishCount, date: dateStr, mealType: type });
        }
        // Only counts as a "ran out of dish bank" shortfall when it wasn't
        // this main's own turn to just stay solo, or aiming for the lower
        // end of the range because it's already a heavy dish — those are
        // both flexibility working as intended, not scarcity.
        if (dishCount < targetCount && !skipBonusPadding) {
          shortSlots++;
          worstShortfall = Math.max(worstShortfall, targetCount - dishCount);
        }
      }
    }
    return { meals: ensureDinnerMains(results, pool), shortSlots, worstShortfall };
  }

  // Safety net for generated and existing dinner slots. Never let a vegetable
  // side become the only dish simply because a plan was regenerated or edited.
  function ensureDinnerMains(meals, pool) {
    const mains = pool.filter(m => !m.side && !m.isComponent && (!m.mealTypes || m.mealTypes.includes("dinner")));
    if (!mains.length) return meals;
    const groups = new Map();
    for (const m of meals) if (m.mealType === "dinner" && m.date) {
      if (!groups.has(m.date)) groups.set(m.date, []);
      groups.get(m.date).push(m);
    }
    const additions = [];
    for (const [date, dishes] of groups) {
      if (dishes.some(m => !m.side && !m.isComponent)) continue;
      const side = dishes[0];
      const choices = mains.filter(m => !dishes.some(d => d.id === m.id));
      const match = choices.find(m => m.cuisine === side.cuisine) || choices[0] || mains[0];
      additions.push({ ...match, date, mealType: "dinner", pax: side.pax,
        uid: match.id + "-" + date + "-dinner-main-" + Math.random().toString(36).slice(2,7) });
    }
    return [...meals, ...additions];
  }

  // DSLR Auto: one tap plans seven dinners, without exposing the full generator.
  // The underlying household, pantry, recipes, shopping and prep state is shared.
  function planMyWeek() {
    const { pool } = getPool();
    if (!pool.some(m => !m.side && !m.isComponent)) { showToast("No complete main dishes match your household preferences."); return; }
    const today = todayDateStr();
    const weekEnd = addDaysToDateStr(today, 6);
    const existingDinners = plan.filter(m => m.mealType === "dinner" && m.date >= today && m.date <= weekEnd);
    if (existingDinners.length && !window.confirm("Replace your existing dinners for the next 7 days? Your breakfast and lunch plans will stay as they are.")) return;
    const { meals } = buildDaySlotsPlan(pool, 7, ["dinner"], today, pantry, {
      min: household.dishesPerMealMin, max: household.dishesPerMealMax,
    });
    setPlan(prev => [
      ...prev.filter(m => !m.date || m.date < today || m.date > weekEnd || m.mealType !== "dinner"),
      ...withSlotPax(ensureDinnerMains(meals, pool)),
    ]);
    setSkippedDays(prev => prev.filter(d => d < today || d > weekEnd));
    setCheckedItems({});
    setScope("week");
    setJustGeneratedWeek(true);
    setTab("week");
    showToast("Your 7 dinners are ready! Tap Swap to change any dish.");
  }

  function movePlannedMeal(uid, date) {
    const old = plan;
    setPlan(prev => prev.map(m => m.uid === uid ? { ...m, date } : m));
    showToast("Moved to another day", () => setPlan(old));
  }

  function handleAddOn() {
    const { pool, softFallback } = getPool();
    if (pool.length === 0) {
      setGenerateNote("No meals match those filters — try loosening them.");
      return;
    }
    const notes = [];
    if (softFallback) notes.push("No soft-food matches — showing all meals instead.");
    const useSoonCount = pantry.filter(k => k.useSoon).length;
    if (useSoonCount) notes.push(`Prioritized ${useSoonCount} item${useSoonCount > 1 ? "s" : ""} from your kitchen you're using up.`);

    const orderedSlots = ["breakfast", "lunch", "dinner"].filter(t => mealSlots.includes(t));

    const daysCount = scope === "day" ? 1 : scope === "week" ? 7 : 30;
    const today = todayDateStr();
    // Keep any already-planned day that hasn't passed yet, and continue
    // the new batch on from wherever the kept plan currently ends —
    // "Add on" extends forward instead of overwriting days that are
    // still valid on the phone's actual calendar.
    const keptMeals = plan.filter(m => m.date && m.date >= today);
    const lastKeptDate = keptMeals.reduce((max, m) => (!max || m.date > max ? m.date : max), null);
    const startDateStr = lastKeptDate ? addDaysToDateStr(lastKeptDate, 1) : today;
    const { meals: newMeals, shortSlots, worstShortfall } = buildDaySlotsPlan(pool, daysCount, orderedSlots, startDateStr, pantry, { min: household.dishesPerMealMin, max: household.dishesPerMealMax });
    if (keptMeals.length) notes.push(`Kept your still-upcoming plan through ${formatDayLabel(lastKeptDate)} and added on from there.`);
    if (shortSlots > 0) notes.push(`Heads up: ${shortSlots} meal${shortSlots > 1 ? "s" : ""} got ${worstShortfall > 1 ? "up to " + worstShortfall + " fewer dishes" : "one fewer dish"} than aimed for — running low on side-dish variety for these cuisines/proteins. Add a few more recipes to fill it out.`);
    setPlan([...keptMeals, ...withSlotPax(newMeals)]);
    setSkippedDays(prev => prev.filter(d => d >= today));
    setGenerateNote(notes.join(" "));
    setCheckedItems({});
    showInterstitialAd();
  }

  // "Redo" replaces whatever's currently planned for the upcoming period
  // (today through however many days the scope covers) with a fresh batch
  // using the current settings — for exactly the case where the wrong meal
  // slots got used and the fix is to redo that stretch, not extend past it.
  function handleRedo() {
    const { pool, softFallback } = getPool();
    if (pool.length === 0) {
      setGenerateNote("No meals match those filters — try loosening them.");
      return;
    }
    const notes = [];
    if (softFallback) notes.push("No soft-food matches — showing all meals instead.");
    const useSoonCount = pantry.filter(k => k.useSoon).length;
    if (useSoonCount) notes.push(`Prioritized ${useSoonCount} item${useSoonCount > 1 ? "s" : ""} from your kitchen you're using up.`);

    const orderedSlots = ["breakfast", "lunch", "dinner"].filter(t => mealSlots.includes(t));

    const daysCount = scope === "day" ? 1 : scope === "week" ? 7 : 30;
    const today = todayDateStr();
    const endDateStr = addDaysToDateStr(today, daysCount - 1);
    const keptMeals = plan.filter(m => m.date && (m.date < today || m.date > endDateStr));
    const { meals: newMeals, shortSlots, worstShortfall } = buildDaySlotsPlan(pool, daysCount, orderedSlots, today, pantry, { min: household.dishesPerMealMin, max: household.dishesPerMealMax });
    notes.push(`Redid ${formatDayLabel(today)} through ${formatDayLabel(endDateStr)}.`);
    if (shortSlots > 0) notes.push(`Heads up: ${shortSlots} meal${shortSlots > 1 ? "s" : ""} got ${worstShortfall > 1 ? "up to " + worstShortfall + " fewer dishes" : "one fewer dish"} than aimed for — running low on side-dish variety for these cuisines/proteins. Add a few more recipes to fill it out.`);
    setPlan([...keptMeals, ...withSlotPax(newMeals)]);
    setSkippedDays(prev => prev.filter(d => d < today || d > endDateStr));
    setGenerateNote(notes.join(" "));
    setCheckedItems({});
    showInterstitialAd();
  }

  function toggleSkipDay(dateStr) {
    setSkippedDays(prev => prev.includes(dateStr) ? prev.filter(d => d !== dateStr) : [...prev, dateStr]);
  }

  // Diets/dislikes only get applied to a dish at the moment it's picked —
  // so changing them AFTER a plan already exists (forgot to set "halal"
  // before generating the week, say) leaves every already-planned meal
  // exactly as it was. This walks the current plan and brings it in line
  // with whatever the household settings say right now: halal/vegetarian
  // substitutions and dislikes get applied in place (same dish, swapped
  // ingredients), and for "soft", anything not soft-friendly gets swapped
  // for a genuinely soft dish since there's no ingredient-level fix for that
  // one.
  function reapplyHouseholdToPlan() {
    const prevPlan = plan;
    const { pool } = getPool();
    let swappedCount = 0;
    const updated = plan.map(meal => {
      let m = adaptMealForDiets(meal, household.diets);
      m = applyDislikeSubs(m, household.dislikedIngredients);
      if (household.diets.includes("soft") && !m.soft) {
        const softPool = pool.filter(p => p.soft && p.id !== m.id && (!m.mealType || p.mealTypes.includes(m.mealType)));
        if (softPool.length) {
          const choice = softPool[Math.floor(Math.random() * softPool.length)];
          swappedCount++;
          return { ...choice, uid: m.uid, date: m.date, mealType: m.mealType, pax: m.pax };
        }
      }
      return m;
    });
    setPlan(updated);
    showToast(
      `Updated your plan to match your current household settings${swappedCount ? ` — swapped ${swappedCount} dish${swappedCount > 1 ? "es" : ""} for softer options` : ""}`,
      () => setPlan(prevPlan)
    );
  }

  function regenerateOne(uid) {
    const meal = plan.find(m => m.uid === uid);
    if (!meal) return;
    const prevPlan = plan;
    const { pool } = getPool();
    let source = pool.filter(p => p.id !== meal.id && p.side === !!meal.side && (!meal.mealType || p.mealTypes.includes(meal.mealType)));
    if (!source.length) source = pool.filter(p => p.id !== meal.id && p.side === !!meal.side);
    if (!source.length) source = pool.filter(p => p.side === !!meal.side);
    if (!source.length) { showToast("No suitable replacement dish available."); return; }
    const choice = source[Math.floor(Math.random() * source.length)];
    setPlan(prevPlan.map(m => m.uid === uid ? { ...choice, uid: m.uid, date: m.date, mealType: m.mealType, pax: m.pax } : m));
    showToast(`Swapped ${meal.name} for ${choice.name}`, () => setPlan(prevPlan));
  }

  // Same slot-filling mechanics as regenerateOne, but for when you already
  // know what you want to cook and don't want to keep rerolling to land on
  // it — jumps straight to a specific dish picked from the list instead of
  // a random one.
  function pickMealById(uid, chosenId, useOriginal) {
    const meal = plan.find(m => m.uid === uid);
    if (!meal || !chosenId) return;
    // Same dish id picked again is normally a no-op — except when it's the
    // "show original" toggle handing back the id of the dish already
    // planned, just its true (unadapted) form instead of the substituted
    // one currently sitting in the plan. That's a real change, not a no-op.
    if (!useOriginal && chosenId === meal.id) return;
    const source = useOriginal ? rawPickableMeals : getPool().pool;
    const choice = source.find(p => p.id === chosenId);
    if (!choice) return;
    if (!!choice.side !== !!meal.side) { showToast("Choose a main dish to replace a main, or a side to replace a side."); return; }
    const prevPlan = plan;
    setPlan(prevPlan.map(m => m.uid === uid ? { ...choice, uid: m.uid, date: m.date, mealType: m.mealType, pax: m.pax } : m));
    showToast(`Set to ${choice.name}`, () => setPlan(prevPlan));
  }

  // Before giving up on the whole dish over one missing ingredient, see if
  // it can just be left out instead — same idea as a disliked ingredient
  // with no substitute (applyDislikeSubs): the dish keeps its place, it just
  // loses that one item. Only refuses to drop it when the ingredient IS the
  // dish — its one real protein, or named in the dish's own title — since
  // serving "Butter Chicken" with no chicken isn't really butter chicken
  // anymore, and a full swap makes more sense there.
  function tryDropIngredient(meal, ingredientName) {
    const idx = meal.ingredients.findIndex(i => wordMatch(i.name.toLowerCase(), ingredientName.toLowerCase()));
    if (idx === -1) return null;
    const target = meal.ingredients[idx];
    const isSoleProtein = target.category === "protein" && meal.ingredients.filter(i => i.category === "protein").length <= 1;
    const namesTheDish = meal.name.toLowerCase().includes(ingredientName.toLowerCase());
    if (isSoleProtein || namesTheDish) return null;
    const ingredients = meal.ingredients.filter((_, i) => i !== idx);
    const adaptNotes = [...(meal.adaptNotes || []), `Left out ${target.name} (not available)`];
    return { ...meal, ingredients, adapted: true, adaptNotes };
  }

  // Fixes one meal specifically because an ingredient turned out to be
  // unavailable at the shop. Tries leaving just that ingredient out first;
  // only swaps the whole dish for another idea when the ingredient can't be
  // dropped without losing what the dish actually is — and even then, avoids
  // picking another dish that needs that same ingredient, so you don't end
  // up needing to redo it all over again.
  function swapMealAvoidingIngredient(uid, ingredientName) {
    const meal = plan.find(m => m.uid === uid);
    if (!meal) return;
    const prevPlan = plan;
    const needsIngredient = (m) => m.ingredients.some(i => wordMatch(i.name.toLowerCase(), ingredientName.toLowerCase()));
    const trimmed = tryDropIngredient(meal, ingredientName);
    let updatedMeal, message;
    if (trimmed) {
      updatedMeal = trimmed;
      message = `Left out ${ingredientName} from ${meal.name}`;
    } else {
      const { pool } = getPool();
      let source = pool.filter(p => p.id !== meal.id && !needsIngredient(p) && (!meal.mealType || p.mealTypes.includes(meal.mealType)));
      if (!source.length) source = pool.filter(p => p.id !== meal.id && !needsIngredient(p));
      if (!source.length) source = pool.filter(p => p.id !== meal.id);
      if (!source.length) source = pool;
      const choice = source[Math.floor(Math.random() * source.length)];
      updatedMeal = { ...choice, uid: meal.uid, date: meal.date, mealType: meal.mealType };
      message = `Couldn't just drop ${ingredientName} — swapped ${meal.name} for ${choice.name} instead`;
    }
    setPlan(prevPlan.map(m => m.uid === uid ? updatedMeal : m));
    showToast(message, () => setPlan(prevPlan));
  }

  function removeOne(uid) {
    const meal = plan.find(m => m.uid === uid);
    if (!meal) return;
    const prevPlan = plan;
    setPlan(prevPlan.filter(m => m.uid !== uid));
    showToast(`Removed ${meal.name} from the plan`, () => setPlan(prevPlan));
  }

  // Adds one more dish to an already-planned day/slot without touching
  // anything else there — for an unexpected guest, or just wanting an extra
  // dish on top of what got generated. Doesn't go through the usual
  // dishes-per-meal min/max logic since it's a deliberate one-off, not
  // something to auto-balance.
  function addExtraDish(date, mealType, chosenId) {
    const { pool } = getPool();
    const choice = pool.find(p => p.id === chosenId);
    if (!choice) return;
    const uid = choice.id + "-" + date + "-" + (mealType || "") + "-" + Math.random().toString(36).slice(2, 7);
    setPlan(prev => [...prev, ...withSlotPax([{ ...choice, uid, date, mealType: mealType || choice.mealTypes?.[0] }])]);
    showToast(`Added ${choice.name}${mealType ? " to " + mealType : ""}`, () => setPlan(prev => prev.filter(m => m.uid !== uid)));
  }

  // A missing ingredient might just be a bad shopping trip, not a permanent
  // "this dish is off" — so instead of dropping or swapping it, push it to
  // the last day in the plan that has the same meal slot (e.g. Monday
  // dinner -> Friday dinner), trading places with whatever's cooked there.
  // No day ends up empty and nothing else in the plan needs redoing; it's
  // just betting that the ingredient will have turned up by then.
  function postponeMeal(uid) {
    const meal = plan.find(m => m.uid === uid);
    if (!meal || !meal.date) return;
    const prevPlan = plan;
    const sameSlotLater = prevPlan.filter(m => m.uid !== uid && m.mealType === meal.mealType && m.date && m.date > meal.date);
    if (!sameSlotLater.length) return; // already the last one of its kind — nothing later to trade with
    const latest = sameSlotLater.reduce((a, b) => (b.date > a.date ? b : a));
    setPlan(prevPlan.map(m => {
      if (m.uid === uid) return { ...m, date: latest.date };
      if (m.uid === latest.uid) return { ...m, date: meal.date };
      return m;
    }));
    showToast(`Moved ${meal.name} to ${formatDayLabel(latest.date)}, swapped places with ${latest.name}`, () => setPlan(prevPlan));
  }
  function canPostponeMeal(uid) {
    const meal = plan.find(m => m.uid === uid);
    if (!meal || !meal.date) return false;
    return plan.some(m => m.uid !== uid && m.mealType === meal.mealType && m.date && m.date > meal.date);
  }

  /* ---- grouping for display ---- */
  const grouped = useMemo(() => {
    if (plan.length === 0) return null;
    if (!plan[0].date) return { flat: true, days: [{ date: null, meals: plan }] };
    const map = {};
    plan.forEach(m => { (map[m.date] = map[m.date] || []).push(m); });
    // Within a day, always breakfast -> lunch -> dinner, whatever order the
    // dishes were added in (a lunch generated after the dinner still lands
    // above it). Stable sort, so dishes within one meal keep their order.
    const slotRank = (t) => { const i = ["breakfast", "lunch", "dinner"].indexOf(t); return i === -1 ? 3 : i; };
    const days = Object.keys(map).sort().map(k => ({ date: k, meals: map[k].map((m, i) => ({ m, i })).sort((x, y) => (slotRank(x.m.mealType) - slotRank(y.m.mealType)) || (x.i - y.i)).map(x => x.m) }));
    return { flat: false, days };
  }, [plan]);

  /* ---- shopping list derivation ---- */
  const targetPax = household.adults + household.kids + household.elderly;
  // Headcount a dish is cooked for: its own (set at generation or edited on
  // the card), otherwise the whole household.
  const paxFor = (meal) => (meal.pax != null ? meal.pax : targetPax);
  // Stamps the current lunch/dinner headcount onto freshly picked dishes.
  const withSlotPax = (meals) => meals.map(m => (m.mealType && slotPax[m.mealType] != null ? { ...m, pax: slotPax[m.mealType] } : m));
  const setSlotHeadcount = (mealType, n) => setSlotPax(prev => ({ ...prev, [mealType]: n }));
  // Changes the headcount for every dish in one meal (a given day + slot) —
  // "dinner tonight is 5 now" applies to the main and its sides together.
  function setMealPax(date, mealType, n) {
    setPlan(prev => prev.map(m => (m.date === date && m.mealType === mealType ? { ...m, pax: n } : m)));
  }

  /* ---- "Cook something now": rank dishes by what's already in the kitchen ---- */
  // For when you're home, hungry, and nothing is planned. Each candidate is
  // scored on how much of its shopping list you already have — seasonings and
  // oils (the pantry-shelf staples) don't count towards "I have the real
  // ingredients", so a dish isn't suggested just because you own salt.
  const cookNowRanked = useMemo(() => {
    const { pool } = getPool();
    const inStock = (name) => {
      const m = findPantryMatch(name, pantry);
      return !!m && (m.quantity == null || m.quantity === "" || m.quantity > 0);
    };
    const scored = pool.filter(m => !m.side).map(m => {
      const real = m.ingredients.filter(i => i.category !== "seasoning");
      const have = real.filter(i => inStock(i.name));
      const missing = real.filter(i => !inStock(i.name)).map(i => i.name);
      const seasoningMissing = m.ingredients.filter(i => i.category === "seasoning" && !inStock(i.name)).map(i => i.name);
      const usesSoon = real.filter(i => { const k = findPantryMatch(i.name, pantry); return k && k.useSoon; }).length;
      return { meal: m, haveCount: have.length, realCount: real.length, missing: missing.concat(seasoningMissing), missingReal: missing.length, usesSoon };
    })
    // Needs at least one real ingredient on hand, and at most 3 real ones missing.
    .filter(x => x.haveCount >= 1 && x.missingReal <= 3);
    scored.sort((a, b) =>
      (a.missingReal - b.missingReal) ||
      (b.usesSoon - a.usesSoon) ||
      (a.meal.time - b.meal.time) ||
      a.meal.name.localeCompare(b.meal.name)
    );
    const forType = (t) => scored.filter(x => (x.meal.mealTypes || ["lunch", "dinner"]).includes(t));
    return { lunch: forType("lunch"), dinner: forType("dinner") };
  }, [getPool, pantry]);

  // Generates one fresh meal (main + sides, same rules as a full plan) for
  // just one day's lunch, dinner or breakfast (today unless a date is given) — for when the plan already covers the day
  // but one slot is empty, or you want a different idea for it. Replaces
  // whatever is currently planned for that slot today; Undo brings it back.
  function generateOne(mealType, pax, dateStr) {
    const { pool } = getPool();
    if (pool.length === 0) { showToast("No meals match those filters — try loosening them."); return; }
    const today = dateStr || todayDateStr();
    const { meals } = buildDaySlotsPlan(pool, 1, [mealType], today, pantry, { min: household.dishesPerMealMin, max: household.dishesPerMealMax });
    if (!meals.length) return;
    const prevPlan = plan;
    const stamped = meals.map(m => ({ ...m, pax: pax != null ? pax : (slotPax[mealType] != null ? slotPax[mealType] : undefined) }));
    setPlan([...prevPlan.filter(m => !(m.date === today && m.mealType === mealType)), ...stamped]);
    showToast(`Planned ${today === todayDateStr() ? "today's" : formatDayLabel(today)} ${mealType}: ${stamped[0].name}`, () => setPlan(prevPlan));
  }

  // Drops the chosen dish into today's lunch/dinner. Not marked cooked — you
  // tick that yourself once it's on the table, same as any planned dish.
  function cookNow(mealId, mealType, pax) {
    const { pool } = getPool();
    const choice = pool.find(p => p.id === mealId);
    if (!choice) return;
    const date = todayDateStr();
    const uid = choice.id + "-" + date + "-" + mealType + "-" + Math.random().toString(36).slice(2, 7);
    setPlan(prev => [...prev, { ...choice, uid, date, mealType, pax: pax != null ? pax : (slotPax[mealType] != null ? slotPax[mealType] : undefined) }]);
    showToast(`Added ${choice.name} to today's ${mealType}`, () => setPlan(prev => prev.filter(m => m.uid !== uid)));
  }

  // Fridge Rescue is intentionally a scratchpad, not a permanent inventory ledger.
  // Only user-selected recipes enter the saved plan; typing never changes pantry stock.
  const rescueIngredients = rescueText.split(/[,;\n]+/).map(x => x.trim().toLowerCase().replace(/^(?:half|some|a few|a little|leftover|leftovers|one|two|three)[ ]+/i, "").trim()).filter(Boolean);
  const rescueMatches = rescueIngredients.length ? getPool().pool.filter(m => !m.side).map(meal => {
    const matched = meal.ingredients.filter(i => rescueIngredients.some(term => wordMatch(i.name.toLowerCase(), term) || i.name.toLowerCase().includes(term)));
    const useSoon = matched.filter(i => pantry.some(k => k.useSoon && wordMatch(k.name.toLowerCase(), i.name.toLowerCase()))).length;
    return { meal, matched, score: matched.length * 4 + useSoon * 3 };
  }).filter(r => r.matched.length > 0).sort((a,b) => b.score - a.score || a.meal.time - b.meal.time).slice(0,6) : [];

  // How many batches of each component recipe (sambal, curry roux, a spice
  // paste — something made from scratch, never planned as its own meal) this
  // plan's dishes actually call for, beyond what's already sitting in the
  // Kitchen. Ingredients that link to a component aren't bought directly —
  // this is what turns "3 dishes need sambal" into "make 1 batch of sambal".
  const componentNeeds = useMemo(() => {
    const demand = {};
    plan.forEach(meal => {
      // Already cooked — whatever component batch it needed has already
      // been made/used, so it shouldn't keep demanding more sambal, roux,
      // etc. on its account.
      if (meal.cooked) return;
      if (meal.date && skippedDays.includes(meal.date)) return;
      const scale = (meal.baseServings && paxFor(meal)) ? paxFor(meal) / meal.baseServings : 1;
      meal.ingredients.forEach(i => {
        if (!i.componentId) return;
        if (!demand[i.componentId]) demand[i.componentId] = { amount: 0, neededFor: new Set() };
        if (i.amount != null) demand[i.componentId].amount += i.amount * scale;
        demand[i.componentId].neededFor.add(meal.name);
      });
    });
    return Object.entries(demand).map(([componentId, d]) => {
      const recipe = myRecipes.find(r => r.id === componentId);
      if (!recipe || !recipe.yieldAmount) return null;
      const match = findPantryMatch(recipe.name, pantry);
      const haveQty = match && match.quantity != null ? match.quantity : 0;
      const shortfall = Math.max(0, d.amount - haveQty);
      const batches = shortfall > 0 ? Math.ceil(shortfall / recipe.yieldAmount) : 0;
      return { componentId, recipe, amountNeeded: d.amount, neededFor: [...d.neededFor], batches };
    }).filter(n => n && n.batches > 0);
  }, [plan, skippedDays, targetPax, myRecipes, pantry]);

  const aggregated = useMemo(() => {
    const map = {};
    plan.forEach(meal => {
      // Already cooked — its ingredients were already bought and just got
      // deducted from Kitchen stock when it was marked cooked, so it
      // shouldn't still be demanding more of them on the shopping list.
      if (meal.cooked) return;
      if (meal.date && skippedDays.includes(meal.date)) return;
      const scale = (meal.baseServings && paxFor(meal)) ? paxFor(meal) / meal.baseServings : 1;
      meal.ingredients.forEach(i => {
        // Made-from-scratch ingredients (sambal, curry roux…) aren't bought
        // directly — what THEY need gets folded in below instead, scaled by
        // however many batches are actually needed.
        if (i.componentId) return;
        const key = i.name.toLowerCase();
        if (!map[key]) map[key] = { key, name: i.name, category: i.category, count: 0, amount: null, unit: null, mealRefs: [], neededFor: [] };
        map[key].count++;
        if (i.amount != null) {
          map[key].amount = (map[key].amount || 0) + i.amount * scale;
          map[key].unit = i.unit;
        }
        // Track which specific planned meals need this ingredient, so if it
        // turns out to be unavailable at the shop, those exact meals can be
        // swapped for something else instead of redoing the whole plan.
        if (!map[key].mealRefs.some(r => r.uid === meal.uid)) {
          map[key].mealRefs.push({ uid: meal.uid, name: meal.name, date: meal.date, mealType: meal.mealType });
        }
      });
    });
    // Fold in what each needed batch of a component recipe itself requires —
    // "make sambal" still needs its own chilis, shrimp paste, etc. bought.
    componentNeeds.forEach(need => {
      need.recipe.ingredients.forEach(i => {
        if (i.componentId) return; // nested components aren't supported yet
        const key = i.name.toLowerCase();
        if (!map[key]) map[key] = { key, name: i.name, category: i.category, count: 0, amount: null, unit: null, mealRefs: [], neededFor: [] };
        map[key].count++;
        if (i.amount != null) {
          map[key].amount = (map[key].amount || 0) + i.amount * need.batches;
          map[key].unit = i.unit;
        }
        if (!map[key].neededFor.includes(need.recipe.name)) map[key].neededFor.push(need.recipe.name);
      });
    });
    extraItems.forEach(i => {
      const key = i.name.toLowerCase();
      if (!map[key]) map[key] = { key, name: i.name, category: i.category, count: 0, amount: null, unit: null, manual: true };
      map[key].count++;
    });
    return Object.values(map);
  }, [plan, extraItems, targetPax, skippedDays, componentNeeds]);

  // Weighs each ingredient against pantry stock. A pantry entry with no
  // quantity set behaves as before (always covered). One with a quantity set
  // gets compared against how much this plan actually needs — if there's
  // partial stock, only the shortfall goes on the buy list, not the full
  // amount, so a bulk-buy-on-sale reduces what you're asked to rebuy rather
  // than being ignored entirely.
  const classified = useMemo(() => {
    return aggregated.map(item => {
      const match = findPantryMatch(item.name, pantry);
      if (!match) return { ...item, covered: false };
      if (match.quantity == null || match.quantity === "") return { ...item, covered: true };
      if (item.amount == null) return { ...item, covered: match.quantity > 0 };
      const sameUnit = (match.unit || "").toLowerCase() === (item.unit || "").toLowerCase();
      if (!sameUnit) return { ...item, covered: match.quantity > 0 };
      if (match.quantity >= item.amount) return { ...item, covered: true };
      return { ...item, covered: false, amount: item.amount - match.quantity, fromStock: true };
    });
  }, [aggregated, pantry]);

  const toBuy = classified.filter(i => !i.covered).sort((a, b) => CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category));
  const haveIt = classified.filter(i => i.covered);

  // Whether a given ingredient is actually in hand yet — either already
  // covered by kitchen stock, or bought and checked off the shopping list.
  // Prep tasks (chop/marinate/freeze) shouldn't be doable, or checkable off,
  // for something that hasn't been bought — no point prepping chicken
  // that isn't in the fridge yet.
  const readyMap = useMemo(() => {
    const map = {};
    classified.forEach(item => { map[item.key] = !!item.covered || !!checkedItems[item.key]; });
    return map;
  }, [classified, checkedItems]);
  function isIngredientReady(name) {
    const key = name.toLowerCase();
    if (!(key in readyMap)) return true; // not on the shopping list at all (e.g. free-text extra) — don't block on it
    return readyMap[key];
  }

  // Weekend-prep derivation — mirrors the shopping-list aggregation above,
  // but groups by "prep action" instead of by ingredient. Chops/washes merge
  // across every dish that needs them ("used in 4 dishes"), so a batch of
  // garlic or a bag of cut vegetables covers the whole week in one go.
  // Marinate/freeze items stay per-dish since they're tied to a specific day.
  // Anything not yet bought shows up locked, so meal prep can't get ahead of
  // the shopping list.
  const prepList = useMemo(() => {
    const aggregateMap = {};
    const perDish = [];
    plan.forEach(meal => {
      // Already cooked — nothing left to prep for this dish, so it
      // shouldn't keep contributing to an aggregate count ("chop garlic —
      // used in 4 dishes") or hold open its own per-dish prep task once
      // it's done. Without this, the Generate tab's prep badge never fully
      // clears even after everything planned has actually been cooked.
      if (meal.cooked) return;
      if (meal.date && skippedDays.includes(meal.date)) return;
      const seenInThisMeal = new Set();
      meal.ingredients.forEach(i => {
        const info = classifyPrepIngredient(i);
        if (!info) return;
        const ready = isIngredientReady(i.name);
        if (info.kind === "aggregate" && pantryHasPreparedForm(pantry, i.name, requiredPrepForm(i, info))) return;
        if (info.kind === "aggregate") {
          const key = info.label;
          if (seenInThisMeal.has(key)) return;
          seenInThisMeal.add(key);
          if (!aggregateMap[key]) aggregateMap[key] = { key, label: info.label, hint: info.hint, count: 0, ready: true };
          aggregateMap[key].count++;
          if (!ready) aggregateMap[key].ready = false; // any un-bought instance locks the whole batch
        } else {
          const key = info.label + "-" + (meal.uid || (meal.id + (meal.date || "") + (meal.mealType || "")));
          if (seenInThisMeal.has(key)) return;
          seenInThisMeal.add(key);
          // For a marinate item, pull the dish's own seasonings so "marinate
          // chicken thigh" doesn't send you back to the recipe just to find
          // out what to marinate it with.
          const withIngredients = info.kind === "marinate"
            ? meal.ingredients
                .filter(x => x.category === "seasoning")
                .map(x => (x.amount != null ? `${formatQty(x.amount)}${x.unit} ` : "") + x.name.toLowerCase())
                .join(", ")
            : "";
          perDish.push({
            key, label: info.label, kind: info.kind,
            date: meal.date, mealType: meal.mealType, dishName: meal.name,
            withIngredients, ready,
          });
        }
      });
    });
    const aggregateItems = Object.values(aggregateMap).sort((a, b) => b.count - a.count);
    perDish.sort((a, b) => (a.date || "").localeCompare(b.date || ""));
    // "Make a batch" tasks — one per component recipe (sambal, curry roux…)
    // this week's plan is actually short of, locked the same way as any
    // other prep task until its own ingredients are bought.
    const makeItems = componentNeeds.map(need => ({
      key: "make-" + need.componentId,
      componentId: need.componentId,
      name: need.recipe.name,
      batches: need.batches,
      yieldAmount: need.recipe.yieldAmount,
      yieldUnit: need.recipe.yieldUnit,
      neededFor: need.neededFor,
      ready: need.recipe.ingredients.every(i => isIngredientReady(i.name)),
    }));
    return { aggregateItems, perDish, makeItems };
  }, [plan, skippedDays, readyMap, componentNeeds, pantry]);

  const pendingPrepCount = prepList.aggregateItems.filter(i => i.ready && !prepChecked[i.key]).length
    + prepList.perDish.filter(i => i.ready && !prepChecked[i.key]).length
    + prepList.makeItems.filter(i => i.ready && !prepChecked[i.key]).length;

  // Meals anywhere in the generated plan (any day, not just today) that
  // haven't been marked cooked yet — skips a day you've deliberately
  // skipped, same as everywhere else. This is what the Generate tab's nav
  // badge is actually meant to communicate: how much cooking is left to do,
  // not just outstanding weekend-prep tasks (that count is folded in too,
  // see below, since both are "still needs doing" signals for this tab).
  const uncookedMealCount = plan.filter(m => !m.cooked && !(m.date && skippedDays.includes(m.date))).length;

  function togglePrepChecked(key, ready, label) {
    if (ready === false) {
      showToast(`Buy${label ? " " + label.replace(/^(chop |wash & cut |marinate |portion & freeze )/i, "") : " it"} first — check it off the shopping list to unlock this`);
      return;
    }
    setPrepChecked(prev => ({ ...prev, [key]: !prev[key] }));
  }

  // Checking off a "make a batch" task is different from an ordinary prep
  // step: ticking it also adds the finished batch(es) into Kitchen stock,
  // the same way buying something does — so sambal you just made is
  // immediately available to whatever recipe called for it, and you can
  // undo the whole thing (stock + checkbox) in one tap if you tick it by
  // mistake.
  function completeComponentBatch(item) {
    if (!item.ready) {
      showToast(`Buy what ${item.name} needs first — check its ingredients off the shopping list to unlock this`);
      return;
    }
    const wasChecked = !!prepChecked[item.key];
    if (wasChecked) {
      setPrepChecked(prev => ({ ...prev, [item.key]: false }));
      return;
    }
    const prevPantry = pantry;
    const prevPrepChecked = prepChecked;
    const madeAmount = item.yieldAmount * item.batches;
    const idx = pantry.findIndex(p => wordMatch(item.name.toLowerCase(), p.name.toLowerCase()));
    if (idx === -1) {
      setPantry(prev => [...prev, {
        id: "k" + Date.now() + Math.random().toString(36).slice(2, 6),
        name: item.name, category: "seasoning",
        location: CATEGORY_DEFAULT_LOCATION.seasoning || "pantry",
        quantity: madeAmount, unit: item.yieldUnit || "", useSoon: false,
      }]);
    } else {
      const existing = pantry[idx];
      const sameUnit = (existing.unit || "").toLowerCase() === (item.yieldUnit || "").toLowerCase();
      if (existing.quantity == null) {
        // already unlimited — nothing to add
      } else if (sameUnit) {
        setPantry(prev => {
          const updated = [...prev];
          updated[idx] = { ...existing, quantity: existing.quantity + madeAmount };
          return updated;
        });
      } else {
        setPantry(prev => [...prev, {
          id: "k" + Date.now() + Math.random().toString(36).slice(2, 6),
          name: item.name, category: existing.category || "seasoning",
          location: existing.location || "pantry",
          quantity: madeAmount, unit: item.yieldUnit || "", useSoon: false,
        }]);
      }
    }
    setPrepChecked(prev => ({ ...prev, [item.key]: true }));
    showToast(`Made a batch of ${item.name} — added ${formatQty(madeAmount)}${item.yieldUnit} to your Kitchen`, () => {
      setPantry(prevPantry);
      setPrepChecked(prevPrepChecked);
    });
  }

  function markPlanUsed() {
    setPantry(prev => {
      const updated = prev.map(p => ({ ...p }));
      plan.forEach(meal => {
        if (meal.cooked) return; // already deducted individually via its own Cooked button
        const scale = (meal.baseServings && paxFor(meal)) ? paxFor(meal) / meal.baseServings : 1;
        meal.ingredients.forEach(i => {
          if (i.amount == null) return;
          const idx = updated.findIndex(p =>
            p.quantity != null && (p.unit || "").toLowerCase() === (i.unit || "").toLowerCase() &&
            wordMatch(i.name.toLowerCase(), p.name.toLowerCase())
          );
          if (idx === -1) return;
          updated[idx].quantity = Math.max(0, updated[idx].quantity - i.amount * scale);
        });
      });
      return updated;
    });
    setPlan(prev => prev.map(m => ({ ...m, cooked: true })));
  }

  // Per-dish version: deducts just this one meal's ingredients from kitchen
  // stock and flags it cooked, so the bulk "mark week as cooked" won't
  // double-deduct it later.
  function markMealCooked(uid) {
    const meal = plan.find(m => m.uid === uid);
    if (!meal || meal.cooked) return;
    const prevPantry = pantry;
    const prevPlan = plan;
    setPantry(prev => {
      const updated = prev.map(p => ({ ...p }));
      const scale = (meal.baseServings && paxFor(meal)) ? paxFor(meal) / meal.baseServings : 1;
      meal.ingredients.forEach(i => {
        if (i.amount == null) return;
        const idx = updated.findIndex(p =>
          p.quantity != null && (p.unit || "").toLowerCase() === (i.unit || "").toLowerCase() &&
          wordMatch(i.name.toLowerCase(), p.name.toLowerCase())
        );
        if (idx === -1) return;
        updated[idx].quantity = Math.max(0, updated[idx].quantity - i.amount * scale);
      });
      return updated;
    });
    setPlan(prev => prev.map(m => m.uid === uid ? { ...m, cooked: true } : m));
    showToast(`Marked ${meal.name} as cooked — kitchen stock updated`, () => { setPantry(prevPantry); setPlan(prevPlan); });
  }

  const toBuyByCategory = useMemo(() => {
    const map = {};
    toBuy.forEach(i => { (map[i.category] = map[i.category] || []).push(i); });
    return map;
  }, [toBuy]);

  function toggleChecked(item) {
    const wasChecked = !!checkedItems[item.key];
    if (!wasChecked) moveToKitchen(item);
    setCheckedItems(prev => ({ ...prev, [item.key]: !prev[item.key] }));
  }

  // When something gets checked off the shopping list, it's now presumably
  // in the kitchen — so it moves there automatically instead of the person
  // having to re-enter it manually. A brand-new item gets its known amount
  // as a tracked quantity; if it already exists as "always have" (no
  // quantity), that's left alone rather than downgraded to a fixed number.
  function moveToKitchen(item) {
    const idx = pantry.findIndex(p => wordMatch(item.name.toLowerCase(), p.name.toLowerCase()));
    if (idx === -1) {
      setPantry(prev => [...prev, {
        id: "k" + Date.now() + Math.random().toString(36).slice(2, 6),
        name: item.name, category: item.category || "other",
        location: CATEGORY_DEFAULT_LOCATION[item.category] || "pantry",
        quantity: item.amount != null ? item.amount : null, unit: item.unit || "", useSoon: false,
      }]);
      return;
    }
    if (item.amount == null) return;
    const existing = pantry[idx];
    if (existing.quantity == null) return; // already unlimited — don't downgrade it
    const sameUnit = (existing.unit || "").toLowerCase() === (item.unit || "").toLowerCase();
    if (!sameUnit) {
      // Can't sum different units (e.g. "packs" vs "g") — rather than
      // silently dropping the newly-bought amount, keep it as its own row
      // so it's still tracked instead of vanishing.
      setPantry(prev => [...prev, {
        id: "k" + Date.now() + Math.random().toString(36).slice(2, 6),
        name: item.name, category: item.category || existing.category || "other",
        location: existing.location || CATEGORY_DEFAULT_LOCATION[item.category] || "pantry",
        quantity: item.amount, unit: item.unit || "", useSoon: false,
      }]);
      showToast(`Added ${item.name} as a separate line — couldn't combine "${item.unit || "no unit"}" with your existing "${existing.unit || "no unit"}"`);
      return;
    }
    setPantry(prev => {
      const updated = [...prev];
      updated[idx] = { ...existing, quantity: existing.quantity + item.amount };
      return updated;
    });
  }

  function addExtraItem(name) {
    const n = name.trim();
    if (!n) return;
    setExtraItems(prev => [...prev, { id: "x" + Date.now(), name: n, category: "other" }]);
  }
  function removeExtraItem(id) {
    setExtraItems(prev => prev.filter(i => i.id !== id));
  }

  function addPantryItem() {
    const n = newPantryName.trim();
    if (!n) return;
    const qty = newPantryQuantity.trim() === "" ? null : Number(newPantryQuantity);
    const unit = newPantryUnit.trim();
    // Adding something already in the kitchen (even with a typo, or a
    // slightly different case) should top up that row, not create a
    // second "Salt" sitting next to the first one — unless the units can't
    // be combined, in which case a second row (rather than silently losing
    // the new amount) is the honest outcome, and we say so.
    const idx = pantry.findIndex(p => wordMatch(n.toLowerCase(), p.name.toLowerCase()));
    if (idx === -1) {
      setPantry(prev => [...prev, {
        id: "p" + Date.now(), name: n, category: newPantryCategory, location: newPantryLocation,
        quantity: qty, unit, useSoon: newPantryUseSoon,
      }]);
    } else {
      const existing = pantry[idx];
      const sameUnit = (existing.unit || "").toLowerCase() === unit.toLowerCase();
      if (existing.quantity == null || qty == null) {
        // Either side is "always have" (no tracked amount) — stays unlimited
        // rather than being downgraded to a specific count.
        setPantry(prev => {
          const updated = [...prev];
          updated[idx] = { ...existing, quantity: null, unit: existing.unit || unit, useSoon: existing.useSoon || newPantryUseSoon };
          return updated;
        });
      } else if (sameUnit) {
        setPantry(prev => {
          const updated = [...prev];
          updated[idx] = { ...existing, quantity: existing.quantity + qty, useSoon: existing.useSoon || newPantryUseSoon };
          return updated;
        });
      } else {
        setPantry(prev => [...prev, {
          id: "p" + Date.now(), name: n, category: newPantryCategory, location: newPantryLocation,
          quantity: qty, unit, useSoon: newPantryUseSoon,
        }]);
        showToast(`Added as a separate "${n}" line — couldn't combine "${unit || "no unit"}" with your existing "${existing.unit || "no unit"}"`);
      }
    }
    setNewPantryName("");
    setNewPantryQuantity("");
    setNewPantryUnit("");
    setNewPantryUseSoon(false);
  }
  function removePantryItem(id) {
    setPantry(prev => prev.filter(p => p.id !== id));
  }
  function togglePantryPreparedForm(id, form) {
    setPantry(prev => prev.map(p => {
      if (p.id !== id) return p;
      const forms = (p.preparedForms || []).map(f => typeof f === "string" ? f : f.form);
      return { ...p, preparedForms: forms.includes(form) ? forms.filter(f => f !== form) : [...forms, form] };
    }));
  }
  function updatePantryQuantity(id, quantity) {
    setPantry(prev => prev.map(p => p.id === id ? { ...p, quantity: quantity === "" ? null : Number(quantity) } : p));
  }
  function toggleUseSoon(id) {
    setPantry(prev => prev.map(p => p.id === id ? { ...p, useSoon: !p.useSoon } : p));
  }
  function updatePantryLocation(id, location) {
    setPantry(prev => prev.map(p => p.id === id ? { ...p, location } : p));
  }
  function clearAllUseSoon() {
    setPantry(prev => prev.map(p => ({ ...p, useSoon: false })));
  }

  // Editing reuses this same function: a payload that already carries an
  // `id` (from a recipe you opened to edit) updates that entry in place;
  // one without an id (a brand-new recipe) gets a fresh one assigned. This
  // is what lets a saved recipe actually be edited instead of only
  // delete-then-re-add.
  function saveRecipe(recipe) {
    if (libraryEdit) { if (!isAdmin) { showToast("Only admins can publish community recipes."); return; } publishLibraryRecipe(recipe, recipeDraft); return; }
    if (recipe.id) {
      setMyRecipes(prev => prev.map(r => r.id === recipe.id ? { ...recipe } : r));
    } else {
      setMyRecipes(prev => [...prev, { ...recipe, id: "u" + Date.now() }]);
    }
  }
  function deleteRecipe(id) {
    setMyRecipes(prev => prev.filter(r => r.id !== id));
  }
  async function publishLibraryRecipe(recipe, draftBackup) {
    if (!isAdmin) { showToast("Only admins can publish community recipes."); return; }
    if (!window.confirm(`Publish "${recipe.name}" to the public Community Library? Everyone can view it. This does not publish your private recipe collection.`)) return;
    try {
      await saveLibraryRecipe(recipe);
      setLibraryEdit(false);
      await refreshLibrary();
      setTab("library");
      showToast("Published to the library");
    } catch (e) {
      if (draftBackup) setRecipeDraft(draftBackup); // don't lose a long form if publishing is refused
      showToast("Couldn't publish. Check you're signed in with the admin account.");
    }
  }
  async function removeLibraryRecipe(id) {
    try { await deleteLibraryRecipe(id); await refreshLibrary(); showToast("Removed from the library"); }
    catch (e) { showToast("Couldn't remove it. Check you're signed in with the admin account."); }
  }
  function addFromLibrary(lib) {
    setMyRecipes(prev => prev.some(r => r.libraryId === lib.id) ? prev : [...prev, {
      ...lib, id: "u" + Date.now(), libraryId: lib.id,
      ingredients: (lib.ingredients || []).map(i => ({ ...i, componentId: null })),
    }]);
    showToast("Added to your recipes");
  }

  const checkedCount = toBuy.filter(i => checkedItems[i.key]).length;

  return (
    <>
    <div className="pmm-backdrop" style={{ fontFamily: FONT_BODY, background: C.paper, minHeight: "100dvh", display: "flex", justifyContent: "center" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
        * { box-sizing: border-box; }
        html, body { background: ${C.paper}; margin: 0; }
        html { scroll-behavior: smooth; }
        input:focus, textarea:focus { outline: 2px solid ${C.mustard}; outline-offset: 1px; }
        button:focus-visible { outline: 2px solid ${C.mustard}; outline-offset: 2px; }
        @media (hover: hover) and (min-width: 700px) {
          ::-webkit-scrollbar { width: 8px; }
          ::-webkit-scrollbar-thumb { background: ${C.line}; border-radius: 999px; }
        }
        details > summary { cursor: pointer; list-style: none; }
        details > summary::-webkit-details-marker { display: none; }
        .expandable .chevron { transform: rotate(0deg); }
        .expandable[open] .chevron { transform: rotate(180deg); }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .spin { animation: spin 1s linear infinite; }
        .pmm-tabs { display: flex; background: #FFFFFF; border-top: 1px solid #E5E3EE; }
        .pmm-tab { flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: center; gap: 3px; padding: 8px 2px 7px; background: transparent; border: none; border-bottom: 3px solid transparent; color: #666A73; font-family: 'IBM Plex Sans', system-ui, sans-serif; font-size: 11px; font-weight: 500; -webkit-tap-highlight-color: transparent; cursor: pointer; }
        .pmm-tab.on { color: #303241; font-weight: 700; border-bottom-color: #EAA28F; background: #FDE9E4; }
        .pmm-tab-ic { position: relative; display: flex; }
        .pmm-tab-lb { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
        .pmm-badge { position: absolute; top: -6px; right: -12px; background: #EAA28F; color: #fff; font-size: 9.5px; font-weight: 700; border-radius: 999px; padding: 1px 5px; font-family: 'IBM Plex Mono', monospace; }
        .pmm-sitelink { display: none; }
        @media (min-width: 1000px) {
          .pmm-tabs { position: fixed; top: 96px; left: calc(50% - 280px - 196px); width: 176px; flex-direction: column; gap: 2px; padding: 8px; background: #FFFFFF; border: 1px solid #E5E3EE; border-radius: 14px; z-index: 6; }
          .pmm-tabs.away { display: none; }
          .pmm-tab { flex: none; flex-direction: row; gap: 10px; justify-content: flex-start; font-size: 14px; padding: 10px 12px; border: none; border-radius: 9px; color: #666A73; }
          .pmm-tab.on { background: #FDE9E4; color: #303241; }
          .pmm-tab-lb { overflow: visible; }
          .pmm-sitelink { display: block; color: #666A73; font-size: 13px; padding: 6px 12px; }
          .pmm-sitelink:hover { color: #303241; }
        }
        @media (min-width: 700px) {
          .pmm-backdrop { background: #EFECE5 !important; }
          .pmm-column { box-shadow: 0 0 0 1px ${C.line}, 0 12px 40px rgba(74,42,31,.18); }
        }
      `}</style>

      {/* No more "phone inside a phone" mockup frame — on the actual
          Android app this WebView already IS the whole screen, so the old
          rounded/bordered/shadowed card with a dark backdrop around it was
          just eating space for no reason. This fills the real screen
          edge-to-edge; maxWidth only keeps it from stretching absurdly wide
          on a tablet. */}
      <div id="app" className="pmm-column" style={{
        width: "100%", maxWidth: 560, background: C.paper,
        display: "flex", flexDirection: "column", minHeight: "100dvh",
        className: undefined,
        position: "relative",
      }}>
        {/* HEADER — one sticky bar: brand (sign-in pill floats top-right),
            then the section tabs. Tabs live at the top like a normal website,
            so nothing fights the phone's bottom edge or the keyboard. */}
        <div style={{ background: "#FFFFFF", color: C.ink, position: "sticky", top: 0, zIndex: 5, boxShadow: "0 2px 8px rgba(36,40,50,0.07)" }}>
          <div style={{ minHeight: 54, display: "flex", alignItems: "center", padding: "0 18px", paddingTop: "env(safe-area-inset-top, 0px)" }}>
            <h1 style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 22, margin: 0, letterSpacing: 0.2 }}>
              Today Cook What
            </h1>
          </div>
          <nav aria-label="Sections" className="pmm-tabs">
            <TabButton icon={ChefHat} label="Home" active={tab === "home"} onClick={() => { setTab("home"); setMoreOpen(false); }} />
            <TabButton icon={Calendar} label="My week" active={tab === "week"} onClick={() => { setTab("week"); setMoreOpen(false); }} />
            <TabButton icon={ShoppingCart} label="Shop" active={tab === "list"} onClick={() => { setTab("list"); setMoreOpen(false); }} badge={toBuy.length || null} />
            <TabButton icon={Check} label="Prep" active={tab === "prep"} onClick={() => { setTab("prep"); setMoreOpen(false); }} badge={pendingPrepCount || null} />
            <TabButton icon={Users} label="Me" active={["me","pantry","library","import","household","admin"].includes(tab)} onClick={() => { setTab("me"); setMoreOpen(false); }} />
          </nav>

        </div>

        {/* CONTENT — normal document flow now, so the page scrolls as a
            whole (header/nav stay put via sticky, not by clipping this). */}
        <div style={{ flex: 1, background: C.paper }}>
          {tab === "home" && (<>
            <GenerateScreen
              scope={scope} setScope={setScope}
              mealSlots={mealSlots} toggleMealSlot={toggleMealSlot}
              onAddOn={handleAddOn}
              onRedo={handleRedo}
              generateNote={generateNote}
              grouped={grouped}
              onRegenerate={regenerateOne}
              onPickMeal={pickMealById}
              pickableMeals={pickableMeals}
              rawPickableMeals={rawPickableMeals}
              onAddExtraDish={addExtraDish}
              slotPax={slotPax} onSetSlotPax={setSlotHeadcount} onSetMealPax={setMealPax}
              cookNowRanked={cookNowRanked} onGenerateOne={generateOne}
              onCookNow={cookNow}
              pantryCount={pantry.length}
              todayDishes={plan.filter(m => m.date === todayDateStr()).map(m => m.mealType)}
              onReapplyHousehold={reapplyHouseholdToPlan}
              onRemove={removeOne}
              household={household}
              skippedDays={skippedDays}
              toggleSkipDay={toggleSkipDay}
              onMarkCooked={markMealCooked}
              prepList={prepList}
              prepChecked={prepChecked}
              togglePrepChecked={togglePrepChecked}
              onCompleteComponentBatch={completeComponentBatch}
              prepCardOpen={prepCardOpen}
              onTogglePrepCard={setPrepCardOpen}
              onAutoPlan={planMyWeek}
              hasWeekPlan={plan.some(m => m.mealType === "dinner" && m.date >= todayDateStr() && m.date <= addDaysToDateStr(todayDateStr(), 6))}
            />            <section style={{margin:"16px 18px 0",border:"1px solid #E5E3EE",borderRadius:20,background:"#fff",padding:16}}>
              <button onClick={()=>setRescueOpen(v=>!v)} aria-expanded={rescueOpen} style={{display:"flex",width:"100%",justifyContent:"space-between",alignItems:"center",border:0,background:"transparent",color:C.ink,textAlign:"left",fontWeight:800,fontSize:16,padding:0}}>
                <span>🥕 Use leftovers · Fridge Rescue</span><span>{rescueOpen?"−":"+"}</span>
              </button>
              <p style={{color:C.inkSoft,fontSize:12,margin:"7px 0 0"}}>Tell us what needs using. No need to update your pantry.</p>
              {rescueOpen && <div style={{display:"grid",gap:12,marginTop:14}}>
                <textarea value={rescueText} onChange={e=>setRescueText(e.target.value)} rows={3} placeholder="e.g. half cabbage, eggs, leftover rice, fishballs" aria-label="Leftover ingredients" style={{border:"1px solid #D8D6E3",borderRadius:12,padding:12,fontFamily:"inherit",fontSize:14,resize:"vertical"}}/>
                {rescueIngredients.length>0 && <div aria-live="polite" style={{display:"grid",gap:9}}>
                  <strong style={{fontSize:13}}>Ideas using your ingredients</strong>
                  {rescueMatches.length===0 ? <p style={{fontSize:13,color:C.inkSoft}}>No matching recipes yet. Try a simpler ingredient name, or add a family recipe under Me.</p> :
                    rescueMatches.map(({meal,matched})=><div key={meal.id} style={{display:"flex",alignItems:"center",gap:9,background:"#F7F7FB",borderRadius:13,padding:9}}>
                      <FoodArt name={meal.name} size={57}/><div style={{flex:1,minWidth:0}}><strong style={{fontSize:13}}>{meal.name}</strong><div style={{fontSize:11,color:C.inkSoft}}>Uses {matched.map(i=>i.name).join(", ")}</div></div>
                      <button onClick={()=>{cookNow(meal.id,"dinner",slotPax.dinner);setTab("week");}} style={{border:0,borderRadius:10,padding:"10px 12px",background:"#EAA28F",fontWeight:800,color:C.ink}}>Plan</button>
                    </div>)}
                  <p style={{fontSize:11,color:C.inkSoft}}>Suggestions may need other ingredients. Check the recipe and food freshness before cooking; refrigerate leftovers promptly.</p>
                </div>}
              </div>}
            </section>

          </>)}
          {tab === "me" && <main style={{ padding: "24px 20px", display: "grid", gap: 14, background:"#FAF7F2", minHeight:"65vh" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#F1EFFB", borderRadius: 20, padding: 16 }}><h2 style={{ margin: 0, fontSize: 28, color: C.ink }}>Your kitchen, your way.</h2><FoodArt kind="fridge" size={95}/></div>
            <p style={{ color: C.inkSoft, margin: "0 0 14px" }}>Everything behind your meals, neatly in one place.</p>
            {[
              ["My kitchen", "pantry", "Pantry, fridge and freezer · ingredients on hand"],
              ["Household & preferences", "household", "People, portions and dietary preferences"],
              ["My cookbook", "import", "Your saved family recipes and cooking steps"],
              ["Discover recipes", "library", "Explore recipes from the community"],
              ...(isAdmin ? [["Admin Studio", "admin", "Review and publish community recipes"]] : []),
            ].map(([label,destination,description]) => <button key={label} onClick={() => setTab(destination)}
              style={{ textAlign: "left", background: "#fff", border: "1px solid #E9E3DF", borderRadius: 20, padding: "20px 18px", color: C.ink, boxShadow:"0 5px 18px rgba(47,42,51,.04)" }}>
              <strong style={{ display: "block", fontSize: 17, fontFamily:FONT_DISPLAY }}>{label}</strong>
              <span style={{ display: "block", marginTop: 5, color: C.inkSoft, fontSize: 13 }}>{description}</span>
            </button>)}
          </main>}
          {tab === "week" && <><div style={{padding:"0 18px"}}>{justGeneratedWeek && <div role="status" style={{margin:"16px 0",padding:16,background:"#F1EFFB",borderRadius:16,border:"1px solid #DCD7F0"}}><strong>✨ Your 7 dinners are ready!</strong><p style={{margin:"6px 0 10px",fontSize:13,color:C.inkSoft}}>This is your week. Swap a dish, skip a day or add another dish whenever you like.</p><button onClick={()=>setJustGeneratedWeek(false)} style={{background:"#EAA28F",border:0,borderRadius:10,padding:"9px 16px",fontWeight:700,color:C.ink}}>Got it</button></div>}</div><SimpleWeek
            plan={plan} skippedDays={skippedDays} onSkip={toggleSkipDay}
            onSwap={pickMealById} onRemove={removeOne} onMove={movePlannedMeal}
            onAdd={addExtraDish} pickableMeals={pickableMeals}
            onGenerate={planMyWeek} pax={targetPax}
            prepList={[...prepList.aggregateItems, ...prepList.perDish]}
            prepChecked={prepChecked} onPrepChecked={togglePrepChecked}
            onOpenKitchen={() => setTab("pantry")} onMarkCooked={markMealCooked}
            shopping={<ShoppingListScreen
              toBuyByCategory={toBuyByCategory} haveIt={haveIt}
              checkedItems={checkedItems} toggleChecked={toggleChecked}
              checkedCount={checkedCount} totalCount={toBuy.length}
              extraItems={extraItems} addExtraItem={addExtraItem}
              removeExtraItem={removeExtraItem} hasPlan={plan.length > 0 || extraItems.length > 0}
              targetPax={targetPax} onMarkUsed={markPlanUsed}
              onSwapMeal={swapMealAvoidingIngredient} onPostponeMeal={postponeMeal}
              canPostponeMeal={canPostponeMeal}
            />}
          /></>}
          {tab === "prep" && <main style={{ padding: "28px 20px 100px", display: "grid", gap: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 15, borderRadius: 20, background: "#E9F3F8" }}><div><div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1.5, color: C.inkSoft }}>PREP, MADE SIMPLE</div><strong>Little jobs. Big relief.</strong></div><FoodArt kind="prep" size={95}/></div>
            <h2 style={{ fontFamily: FONT_DISPLAY, fontSize: 30, lineHeight: 1.2, margin: 0 }}>A little now. Less later.</h2>
            <p style={{ color: C.inkSoft, lineHeight: 1.6, margin: "0 0 8px" }}>Your checklist follows your current meals and kitchen stock. Tick tasks as you finish them.</p>
            {plan.length === 0 && <button onClick={planMyWeek} style={{ border: 0, borderRadius: 14, background: C.mustard, color: C.ink, padding: 17, fontWeight: 700 }}>Plan my week first</button>}
            {[...prepList.aggregateItems, ...prepList.perDish].length === 0 && plan.length > 0 && <p>No preparation needed for this plan.</p>}
            {[...prepList.aggregateItems, ...prepList.perDish].map(item => <label key={item.key} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: 16, background: "#fff", border: `1px solid ${C.line}`, borderRadius: 14 }}>
              <input type="checkbox" checked={!!prepChecked[item.key]} disabled={item.ready === false} onChange={() => togglePrepChecked(item.key, item.ready, item.label)} style={{ marginTop: 4, width: 19, height: 19, accentColor: C.ink }} />
              <span><strong style={{ display: "block" }}>{item.label}</strong>{item.hint && <span style={{ display: "block", color: C.inkSoft, fontSize: 12, marginTop: 5 }}>{item.hint}</span>}{item.ready === false && <span style={{ display: "block", color: C.clayText, fontSize: 12, marginTop: 5 }}>Buy ingredients first</span>}</span>
            </label>)}
            {prepList.makeItems.length > 0 && <section style={{ padding: 17, borderRadius: 15, background: "#fff", border: `1px solid ${C.line}` }}>
              <h3 style={{ marginTop: 0 }}>Batch components</h3>
              {prepList.makeItems.map(item => <button key={item.key} onClick={() => completeComponentBatch(item)} disabled={!item.ready} style={{ width: "100%", display: "flex", gap: 10, textAlign: "left", padding: 12, marginTop: 8, background: C.paper, border: `1px solid ${C.line}`, borderRadius: 10, color: C.ink }}>
                <span>{prepChecked[item.key] ? "☑" : "☐"}</span><span>{item.label}</span>
              </button>)}
            </section>}
            <p style={{ fontSize: 12, color: C.inkSoft, lineHeight: 1.6 }}>Keep chilled foods cold and freeze portions you won't use within a safe storage period. Prep only ingredients you can store safely.</p>
          </main>}
          {tab === "list" && <div style={{ background: "#FDECE8", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 20px" }}><div><strong>Shop smart, cook happy.</strong><div style={{ fontSize: 12, color: C.inkSoft }}>Only what your kitchen needs.</div></div><FoodArt kind="shop" size={92}/></div>}
          {tab === "list" && (
            <ShoppingListScreen
              toBuyByCategory={toBuyByCategory}
              haveIt={haveIt}
              checkedItems={checkedItems}
              toggleChecked={toggleChecked}
              checkedCount={checkedCount}
              totalCount={toBuy.length}
              extraItems={extraItems}
              addExtraItem={addExtraItem}
              removeExtraItem={removeExtraItem}
              hasPlan={plan.length > 0 || extraItems.length > 0}
              targetPax={targetPax}
              onMarkUsed={markPlanUsed}
              onSwapMeal={swapMealAvoidingIngredient}
              onPostponeMeal={postponeMeal}
              canPostponeMeal={canPostponeMeal}
            />
          )}
          {["pantry","household","import","library","admin"].includes(tab) && (
            <nav aria-label="Me section navigation" style={{padding:"14px 18px 12px",background:"#FAF7F2",borderBottom:"1px solid #E9E3DF"}}>
              <button onClick={()=>setTab("me")} style={{display:"inline-flex",alignItems:"center",gap:7,background:"transparent",border:0,color:C.ink,fontWeight:750,fontSize:14,padding:"8px 0",marginBottom:10}}>
                <span aria-hidden="true">←</span> Back to Me
              </button>
              <div style={{display:"flex",gap:8,flexWrap:"wrap",paddingBottom:4}}>
                {[["pantry","My kitchen"],["household","Household"],["import","My cookbook"],["library","Discover"],...(isAdmin?[["admin","Admin"]]:[])].map(([id,label])=>(
                  <button key={id} onClick={()=>setTab(id)} aria-current={tab===id?"page":undefined} style={{flexShrink:0,border:tab===id?"1px solid #D88D79":"1px solid #E9E3DF",background:tab===id?"#FCE5DE":"#fff",color:C.ink,borderRadius:999,padding:"10px 13px",fontSize:13,fontWeight:tab===id?800:600}}>
                    {label}
                  </button>
                ))}
              </div>
            </nav>
          )}
          {tab === "pantry" && (
            <PantryScreen
              pantry={pantry}
              removePantryItem={removePantryItem}
              updatePantryQuantity={updatePantryQuantity}
              toggleUseSoon={toggleUseSoon}
              updatePantryLocation={updatePantryLocation}
              togglePantryPreparedForm={togglePantryPreparedForm}
              clearAllUseSoon={clearAllUseSoon}
              newPantryName={newPantryName} setNewPantryName={setNewPantryName}
              newPantryCategory={newPantryCategory} setNewPantryCategory={setNewPantryCategory}
              newPantryLocation={newPantryLocation} setNewPantryLocation={setNewPantryLocation}
              newPantryQuantity={newPantryQuantity} setNewPantryQuantity={setNewPantryQuantity}
              newPantryUnit={newPantryUnit} setNewPantryUnit={setNewPantryUnit}
              newPantryUseSoon={newPantryUseSoon} setNewPantryUseSoon={setNewPantryUseSoon}
              addPantryItem={addPantryItem}
            />
          )}
          {(tab === "library" || (tab === "admin" && isAdmin)) && (
            <LibraryScreen
              library={library} isAdmin={isAdmin && tab === "admin"} configured={cloudSnapshot().configured} myRecipes={myRecipes}
              onAdd={addFromLibrary} onRefresh={refreshLibrary} onDelete={removeLibraryRecipe}
              onNew={() => { setRecipeDraft(null); setLibraryEdit(true); setLibraryIntent({}); setTab("import"); }}
              onEdit={(r) => { setRecipeDraft(null); setLibraryEdit(true); setLibraryIntent({ recipe: r }); setTab("import"); }}
            />
          )}
          {tab === "import" && (
            <ImportScreen myRecipes={myRecipes} saveRecipe={saveRecipe} deleteRecipe={deleteRecipe} household={household} draft={recipeDraft} setDraft={setRecipeDraft}
              libraryEdit={libraryEdit} setLibraryEdit={setLibraryEdit} libraryIntent={libraryIntent} clearLibraryIntent={() => setLibraryIntent(null)} />
          )}
          {tab === "household" && (
            <HouseholdScreen
              household={household} toggleDiet={toggleDiet} setHouseholdCount={setHouseholdCount}
              setDishesPerMealRange={setDishesPerMealRange} toggleHouseholdList={toggleHouseholdList}
              addDislike={addDislike} removeDislike={removeDislike}
              syncSettings={syncSettings} setSyncField={setSyncField} syncStatus={syncStatus}
              onPushToCloud={handlePushToCloud} onPullFromCloud={handlePullFromCloud}
              onRestartTour={restartTour}
            />
          )}
          {(tab === "generate" || tab === "list") && <AdSlot />}
          <SiteFooter />
        </div>

        <Toast toast={toast} onDismiss={dismissToast} onUndo={(undo) => { undo(); dismissToast(); }} />

        {showTour && (
          <OnboardingTour
            step={tourStep}
            onNext={() => setTourStep(s => Math.min(s + 1, TOUR_STEPS.length - 1))}
            onBack={() => setTourStep(s => Math.max(s - 1, 0))}
            onSkip={finishTour}
          />
        )}
      </div>
    </div>
    </>
  );
}

// Confirms the effect of an action right where it happened — "Moved to Fri
// dinner", "Left out egg", "Couldn't combine, added as a new item" — instead
// of leaving the person to notice the change (or not) somewhere else in the
// app. Reversible actions get an Undo button that restores the exact state
// from right before the action ran.
function Toast({ toast, onDismiss, onUndo }) {
  if (!toast) return null;
  return (
    <div style={{
      position: "fixed", left: 12, right: 12, bottom: 16, zIndex: 20,
      maxWidth: 536, margin: "0 auto",
      background: C.ink, color: C.paper, borderRadius: 10, padding: "10px 12px",
      display: "flex", alignItems: "center", gap: 10, boxShadow: "0 8px 20px rgba(0,0,0,0.35)",
    }}>
      <span style={{ fontFamily: FONT_BODY, fontSize: 12.5, flex: 1, lineHeight: 1.4 }}>{toast.message}</span>
      {toast.undo && (
        <button
          onClick={() => onUndo(toast.undo)}
          style={{ fontFamily: FONT_BODY, fontSize: 12, fontWeight: 700, color: C.mustard, background: "transparent", border: "none", cursor: "pointer", flexShrink: 0 }}
        >Undo</button>
      )}
      <button onClick={onDismiss} style={{ color: C.paper, opacity: 0.6, background: "transparent", border: "none", cursor: "pointer", flexShrink: 0, display: "flex" }}>
        <X size={14} />
      </button>
    </div>
  );
}

function TabButton({ icon: Icon, label, active, onClick, badge }) {
  return (
    <button onClick={onClick} aria-current={active ? "page" : undefined} className={"pmm-tab" + (active ? " on" : "")}>
      <span className="pmm-tab-ic">
        <Icon size={18} strokeWidth={active ? 2.4 : 1.9} />
        {!!badge && <span className="pmm-badge">{badge}</span>}
      </span>
      <span className="pmm-tab-lb">{label}</span>
    </button>
  );
}

/* ---------------------------------------------------------------
   GENERATE SCREEN
------------------------------------------------------------------*/
function GenerateScreen(props) {
  const {
    scope, setScope,
    mealSlots, toggleMealSlot,
    onAddOn, onRedo, generateNote, grouped, onRegenerate, onPickMeal, pickableMeals, rawPickableMeals, onAddExtraDish, onReapplyHousehold, onRemove, household,
    cookNowRanked, onGenerateOne, onCookNow, pantryCount, todayDishes, slotPax, onSetSlotPax, onSetMealPax,
    skippedDays, toggleSkipDay, onMarkCooked,
    prepList, prepChecked, togglePrepChecked, onCompleteComponentBatch, prepCardOpen, onTogglePrepCard, onAutoPlan, hasWeekPlan,
  } = props;

  const totalPax = household.adults + household.kids + household.elderly;
  const [cookType, setCookType] = useState(() => (new Date().getHours() < 15 ? "lunch" : "dinner"));
  const [cookOffset, setCookOffset] = useState(0);
  const [cookOpen, setCookOpen] = useState(false);
  const [showLegacyPlan, setShowLegacyPlan] = useState(false);
  const [planningMode, setPlanningMode] = useState("auto");
  const [cookPaxOverride, setCookPaxOverride] = useState(null); // null = follow the lunch/dinner headcount
  const cookPax = cookPaxOverride != null ? cookPaxOverride : (slotPax && slotPax[cookType] != null ? slotPax[cookType] : totalPax);
  const cookList = (cookNowRanked && cookNowRanked[cookType]) || [];
  const cookShown = cookList.length
    ? Array.from({ length: Math.min(3, cookList.length) }, (_, i) => cookList[(cookOffset + i) % cookList.length])
    : [];
  const alreadyToday = (todayDishes || []).filter(t => t === cookType).length;

  const dietLabels = household.diets.map(d => DIET_OPTIONS.find(o => o.id === d)?.label).filter(Boolean);

  // Preview dates for each action, so it's clear before clicking which days
  // get replaced vs which get added — this is exactly what to check to avoid
  // ending up with the wrong meal slots on the wrong week.
  const daysCount = scope === "day" ? 1 : scope === "week" ? 7 : scope === "month" ? 30 : null;
  const today = todayDateStr();
  let lastPlannedDate = null;
  if (grouped && !grouped.flat) {
    lastPlannedDate = grouped.days.reduce((max, d) => (!max || d.date > max ? d.date : max), null);
  }
  const addOnStart = (lastPlannedDate && lastPlannedDate >= today) ? addDaysToDateStr(lastPlannedDate, 1) : today;
  const addOnEnd = daysCount ? addDaysToDateStr(addOnStart, daysCount - 1) : null;
  const redoEnd = daysCount ? addDaysToDateStr(today, daysCount - 1) : null;

  // Easy-to-miss context: a plan made a while ago (or last session) can sit
  // there with no obvious sign it already exists, so people either forget
  // it's there or can't tell how far it still reaches. Surface it plainly
  // right at the top, before the Generate/Redo buttons.
  let planCoverage = null;
  if (grouped && !grouped.flat && grouped.days.length > 0) {
    const dates = grouped.days.map(d => d.date).filter(Boolean).sort();
    if (dates.length > 0) {
      planCoverage = {
        first: dates[0],
        last: dates[dates.length - 1],
        count: dates.length,
        allPast: dates[dates.length - 1] < today,
      };
    }
  }

  return (
    <div style={{ padding: "18px 18px 28px", maxWidth: 760, margin: "0 auto", color:C.ink }}>
      {<section style={{background:"#FCE9E5",borderRadius:24,padding:20,display:"grid",gap:14,marginBottom:18}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12}}>
          <div><span style={{fontSize:11,fontWeight:800,letterSpacing:1.5,color:"#A65D4E"}}>POINT & SHOOT</span>
            <h3 style={{fontFamily:FONT_DISPLAY,fontSize:27,lineHeight:1.2,margin:"7px 0"}}>Dinner, handled.</h3>
            <p style={{fontSize:13,lineHeight:1.6,color:C.inkSoft,margin:0}}>Seven dinners, using what’s in your kitchen first. Shopping and prep update automatically.</p></div>
          <FoodArt kind="meal" size={112}/>
        </div>
        <button onClick={onAutoPlan} style={{border:0,borderRadius:16,background:"#EAA28F",padding:17,color:C.ink,fontSize:16,fontWeight:800,boxShadow:"0 3px 0 #C87865"}}>{hasWeekPlan ? "↻ Refresh my 7 dinners →" : "🍳 Plan my 7 dinners →"}</button>
        <span style={{fontSize:12,color:C.inkSoft,textAlign:"center"}}>{hasWeekPlan ? "Your current dinners will be kept until you confirm a refresh." : "Get 7 dinner ideas in one tap. Your shopping list and prep tasks will be created automatically."}</span>
      </section>}
      <section style={{marginBottom:18}} aria-label="More planning options">
        <div style={{fontSize:13,fontWeight:800,marginBottom:10,color:C.ink}}>Need a different plan?</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr",gap:10}}>
          {[["custom","🎛 Custom","Choose days and meals"]].map(([id,label,description])=><button key={id} onClick={()=>setPlanningMode(planningMode===id?"auto":id)} aria-pressed={planningMode===id} style={{textAlign:"left",minWidth:0,border:planningMode===id?"2px solid #EAA28F":"1px solid #E5E3EE",borderRadius:16,padding:"14px 12px",background:planningMode===id?"#F1EFFB":"#fff",color:C.ink,cursor:"pointer"}}>
            <strong style={{display:"block",fontSize:15}}>{label}</strong><span style={{display:"block",fontSize:12,color:C.inkSoft,marginTop:5}}>{description}</span>
          </button>)}
        </div>
      </section>
      {planningMode!=="auto" && <section style={{background:"#fff",border:`1px solid ${C.line}`,borderRadius:22,padding:17,marginBottom:16}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}><FoodArt kind={planningMode==="custom"?"meal":"prep"} size={75}/><div>
          <strong style={{fontFamily:FONT_DISPLAY,fontSize:22}}>{planningMode==="custom"?"Make it yours":"Every detail, your way"}</strong>
          <p style={{fontSize:12,color:C.inkSoft,margin:"5px 0 0"}}>{planningMode==="custom"?"Pick the days and meals. We'll handle the rest.":"Set exact servings and open detailed editing only when you need it."}</p>
        </div></div>
      </section>}
      {planningMode==="manual" && <>
      {(totalPax > 0 || dietLabels.length > 0) && (
        <div style={{
          display: "flex", alignItems: "center", gap: 6, marginBottom: 10, fontSize: 11.5,
          color: C.jade700, fontFamily: FONT_MONO, background: "#EAF3EE", borderRadius: 8, padding: "7px 10px",
        }}>
          <Users size={12} />
          <span>
            Planning for {totalPax || "your"} {totalPax === 1 ? "person" : "people"}
            {dietLabels.length ? ` · ${dietLabels.join(", ")}` : ""}
          </span>
        </div>
      )}

      {planCoverage && (
        <div style={{
          display: "flex", alignItems: "center", gap: 6, marginBottom: 10, fontSize: 11.5,
          color: planCoverage.allPast ? C.clayText : C.jade700, fontFamily: FONT_MONO,
          background: planCoverage.allPast ? "#F7E6DC" : "#EAEFE3", borderRadius: 8, padding: "7px 10px",
        }}>
          <Calendar size={12} style={{ flexShrink: 0 }} />
          <span>
            {planCoverage.allPast
              ? <>Your last plan only covers {formatDayLabel(planCoverage.first)}{planCoverage.count > 1 ? ` – ${formatDayLabel(planCoverage.last)}` : ""}, which has passed — tap Generate for something current.</>
              : <>You already have a plan for {formatDayLabel(planCoverage.first)}{planCoverage.count > 1 ? ` – ${formatDayLabel(planCoverage.last)}` : ""} ({planCoverage.count} day{planCoverage.count > 1 ? "s" : ""}) — scroll down to see it.</>}
          </span>
        </div>
      )}

      {!grouped && (
        <div style={{
          display: "flex", alignItems: "center", gap: 6, marginBottom: 10, fontSize: 11, color: C.jade700,
          fontFamily: FONT_MONO, background: "#EAEFE3", borderRadius: 8, padding: "7px 10px", lineHeight: 1.4,
        }}>
          <Sparkles size={12} style={{ flexShrink: 0 }} />
          <span>Already logged a discount haul in Kitchen? This plan will build around it. Otherwise, generate now and shop off the list after.</span>
        </div>
      )}

      {/* cook something now */}
      <div style={{ background: "#fff", border: `1.5px solid ${C.line}`, borderRadius: 14, marginBottom: 16, overflow: "hidden" }}>
        <button
          onClick={() => setCookOpen(o => !o)}
          style={{
            width: "100%", display: "flex", alignItems: "center", gap: 8, background: "transparent", border: "none",
            padding: "12px 14px", textAlign: "left", fontFamily: FONT_BODY,
          }}
        >
          <ChefHat size={16} style={{ color: C.jade700, flexShrink: 0 }} />
          <span style={{ flex: 1 }}>
            <span style={{ display: "block", fontWeight: 700, fontSize: 13.5, color: C.jade900 }}>Cook something now</span>
            <span style={{ display: "block", fontSize: 11.5, color: C.jade700, fontFamily: FONT_MONO }}>Unplanned lunch or dinner, from what's in your kitchen</span>
          </span>
          <ChevronDown size={16} style={{ color: C.jade700, transform: cookOpen ? "rotate(180deg)" : "none" }} />
        </button>
        {cookOpen && (
          <div style={{ padding: "0 14px 14px" }}>
            <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
              {["lunch", "dinner"].map(t => (
                <Chip key={t} active={cookType === t} onClick={() => { setCookType(t); setCookOffset(0); setCookPaxOverride(null); }}>{capitalize(t)}</Chip>
              ))}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <Users size={12} style={{ color: C.jade700 }} />
              <span style={{ fontSize: 12, color: C.jade700, fontFamily: FONT_MONO }}>Cooking for</span>
              <button onClick={() => setCookPaxOverride(Math.max(1, cookPax - 1))} style={stepBtnStyle}>−</button>
              <span style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 13, minWidth: 40, textAlign: "center" }}>{cookPax} pax</span>
              <button onClick={() => setCookPaxOverride(Math.min(30, cookPax + 1))} style={stepBtnStyle}>+</button>
            </div>
            {alreadyToday > 0 && (
              <div style={{ fontSize: 11.5, color: C.clayText, fontFamily: FONT_MONO, marginBottom: 8, lineHeight: 1.4 }}>
                You already have {alreadyToday} {cookType} dish{alreadyToday > 1 ? "es" : ""} planned today — this adds another on top.
              </div>
            )}
            {cookShown.length === 0 ? (
              <div style={{ fontSize: 12.5, color: C.jade700, lineHeight: 1.5 }}>
                {pantryCount === 0
                  ? "Your kitchen is empty. Add what you have in the Kitchen tab and I'll suggest something to cook."
                  : "Nothing matches your kitchen well enough yet. Add more of what you have in the Kitchen tab."}
                <button
                  onClick={() => onGenerateOne(cookType, cookPax)}
                  style={{
                    display: "block", width: "100%", marginTop: 10, background: C.jade700, color: C.paper, border: "none", borderRadius: 10,
                    padding: "10px 0", fontFamily: FONT_BODY, fontWeight: 700, fontSize: 12.5,
                  }}
                >Plan today's {cookType} for me ({cookPax} pax)</button>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {cookShown.map(x => (
                  <div key={x.meal.id} style={{ border: `1px solid ${C.line}`, borderRadius: 10, padding: "10px 12px", background: C.paper }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 14.5, color: C.jade900 }}>{x.meal.name}</div>
                        <div style={{ fontSize: 11, fontFamily: FONT_MONO, color: C.jade700, marginTop: 2 }}>
                          {x.meal.time} min · {x.meal.cuisine}{x.usesSoon > 0 ? " · uses up use-soon items" : ""}
                        </div>
                      </div>
                      <button
                        onClick={() => onCookNow(x.meal.id, cookType, cookPax)}
                        style={{
                          background: C.mustard, color: C.jade900, border: "none", borderRadius: 10, padding: "8px 12px",
                          fontFamily: FONT_BODY, fontWeight: 700, fontSize: 12.5, boxShadow: "0 2px 0 " + C.mustardDeep, flexShrink: 0,
                        }}
                      >Cook this</button>
                    </div>
                    <div style={{ fontSize: 11.5, marginTop: 6, color: x.missing.length ? C.clayText : C.jade700, fontFamily: FONT_MONO, lineHeight: 1.4 }}>
                      {x.missing.length === 0 ? "✓ You have everything" : `Missing: ${x.missing.join(", ")}`}
                    </div>
                  </div>
                ))}
                <button
                  onClick={() => onGenerateOne(cookType, cookPax)}
                  style={{
                    background: C.jade700, color: C.paper, border: "none", borderRadius: 10,
                    padding: "10px 0", fontFamily: FONT_BODY, fontWeight: 700, fontSize: 12.5,
                  }}
                >Plan today's {cookType} for me ({cookPax} pax)</button>
                {cookList.length > cookShown.length && (
                  <button
                    onClick={() => setCookOffset(o => (o + 3) % cookList.length)}
                    style={{
                      background: "transparent", border: `1.5px solid ${C.line}`, color: C.jade700, borderRadius: 10,
                      padding: "8px 0", fontFamily: FONT_BODY, fontWeight: 600, fontSize: 12.5,
                    }}
                  >Show other ideas</button>
                )}
              </div>
            )}
            <div style={{ fontSize: 11, color: C.jade700, fontFamily: FONT_MONO, marginTop: 10, lineHeight: 1.4 }}>
              Added to today, so any missing items show up on your shopping list.
            </div>
          </div>
        )}
      </div>

      </>}
      {planningMode!=="auto" && <>
      {/* scope */}
      <SectionLabel>How much to plan</SectionLabel>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
        {SCOPES.map(s => (
          <Chip key={s.id} active={scope === s.id} onClick={() => setScope(s.id)}>{s.label}</Chip>
        ))}
      </div>

      <div style={{ marginBottom: 18 }}>
        <SectionLabel>Meals to include each day</SectionLabel>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {["breakfast", "lunch", "dinner"].map(t => (
            <Chip key={t} active={mealSlots.includes(t)} onClick={() => toggleMealSlot(t)}>{capitalize(t)}</Chip>
          ))}
        </div>
      </div>

      {planningMode==="manual" && mealSlots.length > 0 && (
        <div style={{ marginBottom: 18 }}>
          <SectionLabel>How many eating</SectionLabel>
          {["breakfast", "lunch", "dinner"].filter(t => mealSlots.includes(t)).map(t => {
            const val = slotPax[t] != null ? slotPax[t] : totalPax;
            return (
              <div key={t} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8, background: C.paperDim, borderRadius: 10, padding: "8px 10px" }}>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: C.ink }}>
                  {capitalize(t)}
                  {slotPax[t] != null && (
                    <button onClick={() => onSetSlotPax(t, null)} style={{ marginLeft: 8, background: "transparent", border: "none", color: C.jade700, fontFamily: FONT_MONO, fontSize: 10.5, textDecoration: "underline", padding: 0 }}>reset to {totalPax}</button>
                  )}
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <button onClick={() => onSetSlotPax(t, Math.max(1, val - 1))} style={stepBtnStyle}>−</button>
                  <span style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 14, minWidth: 40, textAlign: "center" }}>{val} pax</span>
                  <button onClick={() => onSetSlotPax(t, Math.min(30, val + 1))} style={stepBtnStyle}>+</button>
                </div>
              </div>
            );
          })}
          <div style={{ fontSize: 11, color: C.inkSoft, fontFamily: FONT_MONO, lineHeight: 1.4 }}>
            Used when you generate. Plans change? Adjust a single meal later with the pax buttons on its dishes.
          </div>
        </div>
      )}

      <div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={onRedo}
            style={{
              flex: 1, background: "#fff", color: C.jade700, border: `1.5px solid ${C.jade700}`, borderRadius: 12,
              padding: "12px 0", fontFamily: FONT_BODY, fontWeight: 700, fontSize: 13.5,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            }}
          >
            <RefreshCw size={15} /> Redo
          </button>
          <button
            onClick={onAddOn}
            style={{
              flex: 1, background: C.mustard, color: C.jade900, border: "none", borderRadius: 12,
              padding: "12px 0", fontFamily: FONT_BODY, fontWeight: 700, fontSize: 13.5,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              boxShadow: "0 4px 0 " + C.mustardDeep,
            }}
          >
            <Plus size={15} /> Generate
          </button>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
          <p style={{ flex: 1, fontSize: 10, color: C.inkSoft, lineHeight: 1.4 }}>
            Replaces {formatDayLabel(today)}{redoEnd && redoEnd !== today ? ` – ${formatDayLabel(redoEnd)}` : ""}
          </p>
          <p style={{ flex: 1, fontSize: 10, color: C.inkSoft, lineHeight: 1.4 }}>
            Adds {formatDayLabel(addOnStart)}{addOnEnd && addOnEnd !== addOnStart ? ` – ${formatDayLabel(addOnEnd)}` : ""} onward
          </p>
        </div>
      </div>

      {generateNote && (
        <p style={{ fontSize: 12, color: C.clayText, marginTop: 8, fontFamily: FONT_BODY }}>{generateNote}</p>
      )}

      </>}
      {/* Advanced plan detail stays available without flooding Manual mode. */}
      {planningMode==="manual" && grouped && <div style={{margin:"22px 0 0",padding:16,borderRadius:18,background:"#fff",border:`1px solid ${C.line}`}}>
        <strong style={{display:"block",fontSize:16}}>Your saved plan is ready</strong>
        <p style={{fontSize:13,color:C.inkSoft,margin:"6px 0 12px"}}>For an easier overview, use My Week. Open detailed editing here only when needed.</p>
        <button onClick={()=>setShowLegacyPlan(v=>!v)} aria-expanded={showLegacyPlan} style={{background:"#F1EFFB",border:0,borderRadius:12,padding:"12px 16px",fontWeight:700,color:C.ink,width:"100%"}}>{showLegacyPlan?"Hide detailed editor ↑":"Open detailed editor ↓"}</button>
      </div>}
      {planningMode==="manual" && grouped && showLegacyPlan && (
        <div style={{ marginTop: 22 }}>
          {prepList && (prepList.aggregateItems.length > 0 || prepList.perDish.length > 0) && (
            <WeekendPrepCard prepList={prepList} prepChecked={prepChecked} togglePrepChecked={togglePrepChecked} onCompleteComponentBatch={onCompleteComponentBatch} open={prepCardOpen} onToggleOpen={onTogglePrepCard} />
          )}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <SectionLabel style={{ marginBottom: 0 }}>Your plan</SectionLabel>
            <button
              onClick={onReapplyHousehold}
              title="Changed your dietary needs or dislikes after this plan was made? Bring it up to date without regenerating everything."
              style={{ display: "flex", alignItems: "center", gap: 5, color: C.jade700, fontSize: 11, fontWeight: 600 }}
            >
              <RefreshCw size={11} /> Apply current settings
            </button>
          </div>
          {grouped.flat ? (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {groupMealsByType(grouped.days[0].meals).map((g, gi) => (
                <div key={gi} style={{ marginBottom: 10 }}>
                  {g.mealType && (
                    <div style={{
                      display: "flex", alignItems: "center", gap: 6, marginBottom: 6,
                      fontSize: 11, fontWeight: 700, color: C.inkSoft, textTransform: "uppercase", letterSpacing: 0.5,
                    }}>
                      <span style={{ width: 6, height: 6, borderRadius: 999, background: C.mustard }} />
                      {capitalize(g.mealType)}{g.items.length > 1 ? ` · ${g.items.length} dishes` : ""}
                    </div>
                  )}
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {g.items.map(m => (
                      <MealCard key={m.uid} meal={m} onRegenerate={() => onRegenerate(m.uid)} onPick={(id, useOriginal) => onPickMeal(m.uid, id, useOriginal)} pickableMeals={pickableMeals} rawPickableMeals={rawPickableMeals} onRemove={() => onRemove(m.uid)} onMarkCooked={() => onMarkCooked(m.uid)} pax={m.pax != null ? m.pax : totalPax} onPaxChange={n => onSetMealPax(m.date, m.mealType, n)} />
                    ))}
                    <AddDishButton date={grouped.days[0].date} mealType={g.mealType} pickableMeals={pickableMeals} onAdd={onAddExtraDish} />
                  </div>
                </div>
              ))}
            </div>
          ) : grouped.days.length > 7 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {grouped.days.map((d, idx) => {
                const skipped = skippedDays.includes(d.date);
                return (
                  <details className="expandable" key={d.date} open={idx === 0}>
                    <summary style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
                      fontFamily: FONT_MONO, fontSize: 12.5, fontWeight: 600, color: C.jade700,
                      padding: "8px 10px", background: C.paperDim, borderRadius: 10,
                    }}>
                      <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {formatDayLabel(d.date)} — {skipped ? "Not cooking" : d.meals.map(m => (m.mealType ? capitalize(m.mealType) + ": " : "") + m.name).join(" · ")}
                      </span>
                      <ChevronDown className="chevron" size={15} color={C.jade700} style={{ flexShrink: 0, transition: "transform .15s" }} />
                    </summary>
                    <div style={{ paddingBottom: 6 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: C.paperDim, borderRadius: 10, padding: "8px 12px", marginBottom: 10 }}>
                        <span style={{ fontSize: 12.5, fontWeight: 700, color: skipped ? C.inkSoft : C.jade700 }}>
                          {skipped ? "Not cooking this day" : "Cooking this day"}
                        </span>
                        <ToggleSwitch on={!skipped} onClick={() => toggleSkipDay(d.date)} label="Toggle cooking for this day" />
                      </div>
                      {!skipped && <MissingSlotButtons date={d.date} meals={d.meals} slotPax={slotPax} totalPax={totalPax} onGenerate={onGenerateOne} />}
                      {skipped ? (
                        <NotCookingCard />
                      ) : (
                        groupMealsByType(d.meals).map((g, gi) => (
                          <div key={gi} style={{ marginBottom: 10 }}>
                            {g.mealType && (
                              <div style={{
                                display: "flex", alignItems: "center", gap: 6, marginBottom: 6,
                                fontSize: 11, fontWeight: 700, color: C.inkSoft, textTransform: "uppercase", letterSpacing: 0.5,
                              }}>
                                <span style={{ width: 6, height: 6, borderRadius: 999, background: C.mustard }} />
                                {capitalize(g.mealType)}{g.items.length > 1 ? ` · ${g.items.length} dishes` : ""}
                              </div>
                            )}
                            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                              {g.items.map(m => (
                                <MealCard key={m.uid} meal={m} onRegenerate={() => onRegenerate(m.uid)} onPick={(id, useOriginal) => onPickMeal(m.uid, id, useOriginal)} pickableMeals={pickableMeals} rawPickableMeals={rawPickableMeals} onRemove={() => onRemove(m.uid)} onMarkCooked={() => onMarkCooked(m.uid)} pax={m.pax != null ? m.pax : totalPax} onPaxChange={n => onSetMealPax(m.date, m.mealType, n)} />
                              ))}
                              <AddDishButton date={d.date} mealType={g.mealType} pickableMeals={pickableMeals} onAdd={onAddExtraDish} />
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </details>
                );
              })}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {grouped.days.map((d, di) => {
                const skipped = skippedDays.includes(d.date);
                return (
                  <div key={d.date} style={{ marginBottom: 18 }}>
                    {/* Sticky, full-bleed band instead of a thin text label —
                        stays pinned at the top while that day's meals scroll
                        underneath, so it's obvious which day you're looking
                        at even after scrolling past several dishes, and hard
                        to mistake for just another line in the list. */}
                    <div style={{
                      position: "sticky", top: 0, zIndex: 5, margin: "0 -18px", padding: "8px 18px",
                      background: C.jade900, display: "flex", alignItems: "center", justifyContent: "space-between",
                    }}>
                      <div style={{ fontFamily: FONT_MONO, fontSize: 12.5, fontWeight: 700, color: C.paper, textTransform: "uppercase", letterSpacing: 0.6 }}>
                        {formatDayLabel(d.date)}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: skipped ? "#C9B8AE" : C.paper }}>
                          {skipped ? "Not cooking" : "Cooking"}
                        </span>
                        <ToggleSwitch on={!skipped} onClick={() => toggleSkipDay(d.date)} label="Toggle cooking for this day" light />
                      </div>
                    </div>
                    <div style={{ paddingTop: 10 }}>
                      {!skipped && <MissingSlotButtons date={d.date} meals={d.meals} slotPax={slotPax} totalPax={totalPax} onGenerate={onGenerateOne} />}
                      {skipped ? (
                        <NotCookingCard />
                      ) : (
                        groupMealsByType(d.meals).map((g, gi) => (
                          <div key={gi} style={{ marginBottom: 10 }}>
                            {g.mealType && (
                              <div style={{
                                display: "flex", alignItems: "center", gap: 6, marginBottom: 6,
                                fontSize: 11, fontWeight: 700, color: C.inkSoft, textTransform: "uppercase", letterSpacing: 0.5,
                              }}>
                                <span style={{ width: 6, height: 6, borderRadius: 999, background: C.mustard }} />
                                {capitalize(g.mealType)}{g.items.length > 1 ? ` · ${g.items.length} dishes` : ""}
                              </div>
                            )}
                            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                              {g.items.map(m => (
                                <MealCard key={m.uid} meal={m} onRegenerate={() => onRegenerate(m.uid)} onPick={(id, useOriginal) => onPickMeal(m.uid, id, useOriginal)} pickableMeals={pickableMeals} rawPickableMeals={rawPickableMeals} onRemove={() => onRemove(m.uid)} onMarkCooked={() => onMarkCooked(m.uid)} pax={m.pax != null ? m.pax : totalPax} onPaxChange={n => onSetMealPax(m.date, m.mealType, n)} />
                              ))}
                              <AddDishButton date={d.date} mealType={g.mealType} pickableMeals={pickableMeals} onAdd={onAddExtraDish} />
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// For a planned day that's missing a meal slot (e.g. you generated dinners
// only, then wanted lunch on one of those days): one tap generates a full
// meal for that slot right there, at that slot's headcount.
function MissingSlotButtons({ date, meals, slotPax, totalPax, onGenerate }) {
  if (!date || date < todayDateStr()) return null;
  const have = new Set(meals.map(m => m.mealType));
  const missing = ["breakfast", "lunch", "dinner"].filter(t => !have.has(t));
  if (!missing.length) return null;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 0, marginBottom: 10 }}>
      {missing.map(t => {
        const pax = slotPax && slotPax[t] != null ? slotPax[t] : totalPax;
        return (
          <button key={t} onClick={() => onGenerate(t, pax, date)} style={{
            flex: "1 1 120px", background: "transparent", border: `1.5px dashed ${C.jade600}`, color: C.jade700,
            borderRadius: 10, padding: "9px 10px", fontFamily: FONT_BODY, fontWeight: 700, fontSize: 12.5,
          }}>
            <Plus size={12} style={{ marginRight: 5, verticalAlign: "-1px" }} />
            Generate {t} ({pax} pax)
          </button>
        );
      })}
    </div>
  );
}

function SectionLabel({ children, style }) {
  return (
    <div style={{
      fontFamily: FONT_MONO, fontSize: 10.5, fontWeight: 600, color: C.inkSoft,
      textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8, ...style,
    }}>{children}</div>
  );
}

function Stepper({ label, value, min, max, onChange }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, background: C.paperDim, borderRadius: 10, padding: "8px 10px" }}>
      <span style={{ fontSize: 12.5, fontWeight: 600, color: C.ink }}>{label}</span>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button onClick={() => onChange(Math.max(min, value - 1))} style={stepBtnStyle}>−</button>
        <span style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 14, width: 16, textAlign: "center" }}>{value}</span>
        <button onClick={() => onChange(Math.min(max, value + 1))} style={stepBtnStyle}>+</button>
      </div>
    </div>
  );
}
const stepBtnStyle = {
  width: 24, height: 24, borderRadius: 999, border: `1px solid ${C.line}`, background: "#fff",
  color: C.jade700, fontWeight: 700, fontSize: 14, lineHeight: "1", display: "flex", alignItems: "center", justifyContent: "center",
};

// Cook time is stored as a plain number of minutes everywhere else in the
// app, but clicking a +/-1 stepper up to something like 200 is painful.
// This lets someone type the number directly, or switch to hours+minutes
// (e.g. "3h 20m") for a long braise/roast/marinade — either way it still
// just writes a total-minutes number back out.
function TimeInput({ minutes, onChange }) {
  // Default to whichever mode already matches the stored value, so opening
  // an existing recipe that's e.g. 200 minutes shows "3h 20m" right away
  // instead of defaulting back to a raw minutes count every time.
  const [unit, setUnit] = useState(minutes >= 60 ? "hr" : "min");
  const clamp = v => Math.max(1, Math.min(1440, v || 0));
  const hoursPart = Math.floor((minutes || 0) / 60);
  const minsPart = (minutes || 0) % 60;
  return (
    <div style={{ marginBottom: 12, background: C.paperDim, borderRadius: 10, padding: "8px 10px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: unit === "hr" ? 8 : 0 }}>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: C.ink }}>Cook time</span>
        <div style={{ display: "flex", gap: 4 }}>
          <Chip active={unit === "min"} onClick={() => setUnit("min")}>Minutes</Chip>
          <Chip active={unit === "hr"} onClick={() => setUnit("hr")}>Hours + min</Chip>
        </div>
      </div>
      {unit === "min" ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={1440}
            value={minutes || ""}
            onChange={e => onChange(clamp(parseInt(e.target.value, 10)))}
            style={{ width: 70, border: `1px solid ${C.line}`, borderRadius: 8, padding: "6px 8px", fontFamily: FONT_MONO, fontWeight: 700, fontSize: 14, textAlign: "center", background: "#fff", color: C.ink }}
          />
          <span style={{ fontSize: 12, color: C.inkSoft }}>minutes</span>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: "auto" }}>
            <button onClick={() => onChange(clamp((minutes || 0) - 5))} style={stepBtnStyle}>−</button>
            <button onClick={() => onChange(clamp((minutes || 0) + 5))} style={stepBtnStyle}>+</button>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            max={24}
            value={hoursPart}
            onChange={e => onChange(clamp((parseInt(e.target.value, 10) || 0) * 60 + minsPart))}
            style={{ width: 55, border: `1px solid ${C.line}`, borderRadius: 8, padding: "6px 8px", fontFamily: FONT_MONO, fontWeight: 700, fontSize: 14, textAlign: "center", background: "#fff", color: C.ink }}
          />
          <span style={{ fontSize: 12, color: C.inkSoft }}>hr</span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            max={59}
            value={minsPart}
            onChange={e => onChange(clamp(hoursPart * 60 + (parseInt(e.target.value, 10) || 0)))}
            style={{ width: 55, border: `1px solid ${C.line}`, borderRadius: 8, padding: "6px 8px", fontFamily: FONT_MONO, fontWeight: 700, fontSize: 14, textAlign: "center", background: "#fff", color: C.ink }}
          />
          <span style={{ fontSize: 12, color: C.inkSoft }}>min</span>
        </div>
      )}
    </div>
  );
}

function ToggleSwitch({ on, onClick, label, light }) {
  const onColor = light ? C.mustard : C.jade700;
  const offColor = light ? "rgba(255,255,255,0.3)" : C.line;
  return (
    <button
      onClick={onClick}
      aria-label={label}
      style={{
        display: "flex", alignItems: "center", gap: 8, background: "transparent", border: "none", padding: 0,
      }}
    >
      <span style={{
        width: 42, height: 24, borderRadius: 999, background: on ? onColor : offColor,
        position: "relative", transition: "background .15s", flexShrink: 0,
      }}>
        <span style={{
          position: "absolute", top: 2, left: on ? 20 : 2, width: 20, height: 20, borderRadius: 999,
          background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.3)", transition: "left .15s",
        }} />
      </span>
    </button>
  );
}

function StepsList({ steps }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 4 }}>
      {steps.map((s, i) => (
        <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
          <span style={{
            flexShrink: 0, width: 22, height: 22, borderRadius: 999, background: C.jade700, color: "#fff",
            fontFamily: FONT_MONO, fontWeight: 700, fontSize: 12, display: "flex", alignItems: "center",
            justifyContent: "center", marginTop: 1,
          }}>{i + 1}</span>
          <span style={{ fontSize: 13.5, color: C.ink, lineHeight: 1.6 }}>{s}</span>
        </div>
      ))}
    </div>
  );
}

function NotCookingCard() {
  return (
    <div style={{
      background: C.paperDim, border: `1.5px dashed ${C.line}`, borderRadius: 12,
      padding: "14px 14px", textAlign: "center",
    }}>
      <span style={{ fontFamily: FONT_BODY, fontWeight: 600, fontSize: 13, color: C.inkSoft }}>
        Not cooking today
      </span>
      <p style={{ fontSize: 11, color: C.inkSoft, marginTop: 3 }}>
        No meals planned, and nothing from this day is added to your shopping list.
      </p>
    </div>
  );
}

// Batch-prep checklist for a busy household — pulls chop/wash tasks that
// repeat across the week's plan into one merged line each ("used in N
// dishes"), so it can all be knocked out in one weekend session, plus a
// short per-dish list for marinating or freezing proteins ahead of time.
function WeekendPrepCard({ prepList, prepChecked, togglePrepChecked, onCompleteComponentBatch, open, onToggleOpen }) {
  const { aggregateItems, perDish, makeItems } = prepList;
  const lockedCount = aggregateItems.filter(i => !i.ready).length + perDish.filter(i => !i.ready).length + makeItems.filter(i => !i.ready).length;
  const pendingCount = aggregateItems.filter(i => i.ready && !prepChecked[i.key]).length
    + perDish.filter(i => i.ready && !prepChecked[i.key]).length
    + makeItems.filter(i => i.ready && !prepChecked[i.key]).length;
  return (
    <details
      className="expandable"
      open={open}
      onToggle={e => onToggleOpen(e.currentTarget.open)}
      style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 12, marginBottom: 16, overflow: "hidden" }}
    >
      <summary style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "12px 14px", background: C.paperDim,
      }}>
        <span style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 14, color: C.ink }}>
          🔪 Weekend prep
          {pendingCount > 0 && (
            <span style={{ fontFamily: FONT_MONO, fontSize: 10, fontWeight: 700, color: "#fff", background: C.clay, borderRadius: 999, padding: "1px 7px" }}>{pendingCount}</span>
          )}
        </span>
        <ChevronDown className="chevron" size={16} color={C.jade700} style={{ flexShrink: 0, transition: "transform .15s" }} />
      </summary>
      <div style={{ padding: "10px 14px 14px" }}>
      <p style={{ fontSize: 11, color: C.inkSoft, marginBottom: 10 }}>
        Knock these out ahead of time and weeknight cooking goes faster. A number badge on this tab means something's still pending.
        {lockedCount > 0 && <> {lockedCount} item{lockedCount > 1 ? "s are" : " is"} locked until it's bought — check it off the shopping list first.</>}
      </p>
      {makeItems.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 9, marginBottom: 12 }}>
          {makeItems.map(item => (
            <label
              key={item.key}
              style={{
                display: "flex", alignItems: "flex-start", gap: 8, cursor: item.ready ? "pointer" : "default",
                opacity: item.ready ? 1 : 0.5, background: "#F2F6EE", border: `1px solid ${C.jade600}`, borderRadius: 9, padding: 8,
              }}
              onClick={() => onCompleteComponentBatch(item)}
            >
              <div style={{ marginTop: 1 }}><Checkbox checked={!!prepChecked[item.key]} /></div>
              <span style={{
                fontSize: 12.5, fontFamily: FONT_BODY, color: prepChecked[item.key] ? C.inkSoft : C.ink,
                textDecoration: prepChecked[item.key] ? "line-through" : "none",
              }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><Link2 size={12} /> Make {item.batches > 1 ? `${item.batches} batches` : "a batch"} of {item.name}</span>{" "}
                <span style={{ color: C.inkSoft, fontFamily: FONT_MONO, fontSize: 11 }}>
                  — makes {formatQty(item.yieldAmount * item.batches)}{item.yieldUnit}, for {item.neededFor.join(", ")}
                </span>
                {!item.ready && (
                  <span style={{ color: C.clayText, fontFamily: FONT_MONO, fontSize: 11, fontWeight: 700 }}> · 🛒 buy its ingredients first</span>
                )}
                {prepChecked[item.key] && (
                  <div style={{ fontSize: 11, color: C.jade700, fontStyle: "italic", marginTop: 2 }}>Added to your Kitchen ✓</div>
                )}
              </span>
            </label>
          ))}
        </div>
      )}
      {aggregateItems.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 9, marginBottom: perDish.length ? 12 : 0 }}>
          {aggregateItems.map(item => (
            <label
              key={item.key}
              style={{ display: "flex", alignItems: "flex-start", gap: 8, cursor: item.ready ? "pointer" : "default", opacity: item.ready ? 1 : 0.5 }}
              onClick={() => togglePrepChecked(item.key, item.ready, item.label)}
            >
              <div style={{ marginTop: 1 }}><Checkbox checked={!!prepChecked[item.key]} /></div>
              <span style={{
                fontSize: 12.5, fontFamily: FONT_BODY, color: prepChecked[item.key] ? C.inkSoft : C.ink,
                textDecoration: prepChecked[item.key] ? "line-through" : "none",
              }}>
                {capitalize(item.label)} <span style={{ color: C.inkSoft, fontFamily: FONT_MONO, fontSize: 11 }}>— used in {item.count} dish{item.count > 1 ? "es" : ""}</span>
                {!item.ready && (
                  <span style={{ color: C.clayText, fontFamily: FONT_MONO, fontSize: 11, fontWeight: 700 }}> · 🛒 buy first</span>
                )}
                {item.hint && (
                  <div style={{ fontSize: 11, color: C.inkSoft, fontStyle: "italic", marginTop: 2 }}>How: {item.hint}</div>
                )}
              </span>
            </label>
          ))}
        </div>
      )}
      {perDish.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
          {perDish.map(item => (
            <label
              key={item.key}
              style={{ display: "flex", alignItems: "flex-start", gap: 8, cursor: item.ready ? "pointer" : "default", opacity: item.ready ? 1 : 0.5 }}
              onClick={() => togglePrepChecked(item.key, item.ready, item.label)}
            >
              <div style={{ marginTop: 1 }}><Checkbox checked={!!prepChecked[item.key]} /></div>
              <span style={{
                fontSize: 12.5, fontFamily: FONT_BODY, color: prepChecked[item.key] ? C.inkSoft : C.ink,
                textDecoration: prepChecked[item.key] ? "line-through" : "none",
              }}>
                {capitalize(item.label)}{" "}
                <span style={{ color: C.inkSoft, fontFamily: FONT_MONO, fontSize: 11 }}>
                  — for {item.date ? formatDayLabel(item.date) : "later"}{item.mealType ? " " + item.mealType : ""} ({item.dishName})
                  {item.kind === "marinate" ? " · best 1–2 days ahead" : ""}
                </span>
                {!item.ready && (
                  <span style={{ color: C.clayText, fontFamily: FONT_MONO, fontSize: 11, fontWeight: 700 }}> · 🛒 buy first</span>
                )}
                {item.withIngredients && (
                  <div style={{ fontSize: 11, color: C.inkSoft, fontStyle: "italic", marginTop: 2 }}>With: {item.withIngredients}</div>
                )}
              </span>
            </label>
          ))}
        </div>
      )}
      </div>
    </details>
  );
}

function MealCard({ meal, onRegenerate, onPick, pickableMeals, rawPickableMeals, onRemove, onMarkCooked, compact, pax, onPaxChange }) {
  const [picking, setPicking] = useState(false);
  const [pickInput, setPickInput] = useState("");
  // Off by default — the picker shows the diet-adapted list (the normal
  // case). Switching this on swaps in the true, unadapted recipes, for the
  // rare deliberate case (a guest who isn't halal/vegetarian, say) where the
  // household's own substitution shouldn't apply to this one dish.
  const [showOriginal, setShowOriginal] = useState(false);
  // Narrow the full pickable list to dishes that actually fit this slot
  // (breakfast/lunch/dinner) when we can — falls back to the full list
  // rather than showing nothing if this meal has no mealType set.
  const options = meal.mealType
    ? pickableMeals?.filter(p => !p.mealTypes || p.mealTypes.includes(meal.mealType))
    : pickableMeals;
  const rawOptions = meal.mealType
    ? rawPickableMeals?.filter(p => !p.mealTypes || p.mealTypes.includes(meal.mealType))
    : rawPickableMeals;
  const activeOptions = showOriginal ? rawOptions : options;
  // A plain <select> doesn't let you type to filter once there are dozens
  // of recipes — this pairs a text input with a <datalist> (same pattern as
  // the cuisine field in Add Recipe) so typing narrows it down, and picking
  // a suggestion that matches a real dish name commits it right away.
  function handlePickInputChange(value) {
    setPickInput(value);
    const match = (activeOptions || []).find(p => p.name.toLowerCase() === value.trim().toLowerCase());
    if (match) {
      onPick(match.id, showOriginal);
      setPicking(false);
      setPickInput("");
    }
  }
  return (
    <div style={{
      background: "#fff", border: `1px solid ${meal.cooked ? C.sage : C.line}`, borderRadius: 12,
      padding: compact ? "10px 12px" : "12px 14px",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: compact ? 14.5 : 16, color: C.ink }}>{meal.name}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 3, flexWrap: "wrap" }}>
            {meal.mealType && <Tag text={meal.mealType} />}
            <Tag text={meal.cuisine} />
            <Tag text={meal.protein} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 3, marginTop: 4, fontSize: 11, color: C.inkSoft, fontFamily: FONT_MONO }}>
            <Clock size={11} /> {formatDuration(meal.time)}
          </div>
          {onPaxChange && meal.date && meal.mealType && !meal.cooked && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6 }} title="Changes the headcount for every dish in this meal">
              <Users size={11} style={{ color: C.inkSoft }} />
              <button onClick={() => onPaxChange(Math.max(1, (pax || 1) - 1))} style={{ ...stepBtnStyle, width: 20, height: 20, fontSize: 12 }}>−</button>
              <span style={{ fontFamily: FONT_MONO, fontSize: 11.5, fontWeight: 700, color: C.ink, minWidth: 40, textAlign: "center" }}>{pax} pax</span>
              <button onClick={() => onPaxChange(Math.min(30, (pax || 1) + 1))} style={{ ...stepBtnStyle, width: 20, height: 20, fontSize: 12 }}>+</button>
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: 4, flexShrink: 0, alignItems: "center" }}>
          {meal.cooked ? (
            <span style={{
              display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, color: C.sageText,
              background: "#EAEFE3", borderRadius: 8, padding: "5px 8px",
            }}>
              <Check size={12} /> Cooked
            </span>
          ) : (
            <IconBtn onClick={onMarkCooked} title="Mark as cooked — deducts from kitchen"><Check size={14} /></IconBtn>
          )}
          <IconBtn
            onClick={() => pickableMeals ? setPicking(v => !v) : onRegenerate()}
            title="Change this dish"
          ><RefreshCw size={14} /></IconBtn>
          <IconBtn onClick={onRemove} title="Remove"><X size={14} /></IconBtn>
        </div>
      </div>
      {meal.photo && (
        <img
          src={meal.photo}
          alt=""
          style={{
            width: "100%", maxHeight: compact ? 140 : 190, objectFit: "cover",
            borderRadius: 9, marginTop: 10, display: "block",
          }}
        />
      )}
      {(meal.creatorName || meal.videoUrl) && <div style={{ marginTop: 8 }}><CreditLine r={meal} /></div>}
      {picking && pickableMeals && (
        <div style={{ marginTop: 8 }}>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <input
              value={pickInput}
              onChange={e => handlePickInputChange(e.target.value)}
              list={`pick-${meal.uid}`}
              placeholder="Type to search dishes…"
              autoFocus
              style={{ flex: 1, border: `1px solid ${C.jade600}`, borderRadius: 8, padding: "8px 8px", fontFamily: FONT_BODY, fontSize: 12.5, background: "#F2F6EE", color: C.ink }}
            />
            <button
              onClick={() => { onRegenerate(); setPicking(false); setPickInput(""); }}
              title="Random idea instead"
              style={{ flexShrink: 0, fontSize: 11.5, fontWeight: 600, color: C.jade700, border: `1px solid ${C.jade600}`, borderRadius: 8, padding: "8px 10px", background: "#fff" }}
            >
              🎲 Surprise me
            </button>
          </div>
          <datalist id={`pick-${meal.uid}`}>
            {(activeOptions || []).map(p => (
              <option key={p.id} value={p.name}>{p.custom ? "Yours" : p.cuisine}</option>
            ))}
          </datalist>
          {!!rawPickableMeals && (
            <label style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6, fontSize: 10.5, color: C.inkSoft }}>
              <input
                type="checkbox"
                checked={showOriginal}
                onChange={e => { setShowOriginal(e.target.checked); setPickInput(""); }}
              />
              Show original recipes (skip household diet swap — e.g. real pork ramen, not the chicken version)
            </label>
          )}
          <p style={{ fontSize: 10, color: C.inkSoft, margin: "4px 0 0" }}>Type and tap a suggestion to set it, or tap Surprise me for a random swap.</p>
        </div>
      )}
      {!compact && (
        <div style={{ marginTop: 8, fontSize: 11.5, color: C.inkSoft, fontFamily: FONT_MONO, lineHeight: 1.6 }}>
          {meal.pax != null || pax ? (
            <div style={{ fontWeight: 700, color: C.jade700, marginBottom: 2 }}>Ingredients for {pax || meal.pax} pax</div>
          ) : null}
          {meal.ingredients.map(i => {
            const scale = (meal.baseServings && pax) ? pax / meal.baseServings : 1;
            return i.amount != null ? `${i.name} ${formatQty(i.amount * scale)}${i.unit ? " " + i.unit : ""}` : i.name;
          }).join(" · ")}
        </div>
      )}
      {meal.adapted && meal.adaptNotes?.length > 0 && (
        <div style={{ marginTop: 6, fontSize: 10.5, color: C.jade700, fontStyle: "italic" }}>
          {meal.adaptNotes.join(" · ")}
        </div>
      )}
      {!compact && meal.steps?.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontFamily: FONT_MONO, fontSize: 12.5, fontWeight: 700, color: C.jade700, display: "flex", alignItems: "center", gap: 6 }}>
            <ChefHat size={14} /> How to cook ({meal.steps.length} steps)
          </div>
          <StepsList steps={meal.steps} />
        </div>
      )}
    </div>
  );
}

// "Unexpected guest" / "just want one more dish" button — sits at the
// bottom of a meal-type group and adds a dish to that day/slot without
// touching anything already planned there. Same type-to-search pattern as
// MealCard's picker, for the same reason (scales past a handful of saved
// recipes).
function AddDishButton({ date, mealType, pickableMeals, onAdd }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  // One-off guest dietary filters — for a visitor whose restriction isn't
  // the household's own standing setting. These only narrow this one
  // add-dish list; they're never saved to household.diets/dislikes.
  const [guestNoPork, setGuestNoPork] = useState(false);
  const [guestVegetarian, setGuestVegetarian] = useState(false);
  const [guestAvoid, setGuestAvoid] = useState("");
  const guestFilterActive = guestNoPork || guestVegetarian || guestAvoid.trim();
  const options = useMemo(() => {
    let list = mealType
      ? pickableMeals?.filter(p => !p.mealTypes || p.mealTypes.includes(mealType))
      : pickableMeals;
    if (!list) return list;
    if (guestNoPork) list = list.filter(p => p.protein !== "pork");
    if (guestVegetarian) list = list.filter(p => VEG_SAFE_PROTEINS.has(p.protein));
    const avoid = guestAvoid.trim().toLowerCase();
    if (avoid) {
      list = list.filter(p => !(p.ingredients || []).some(i => wordMatch(avoid, i.name.toLowerCase())));
    }
    return list;
  }, [pickableMeals, mealType, guestNoPork, guestVegetarian, guestAvoid]);
  function handleChange(value) {
    setInput(value);
    const match = (options || []).find(p => p.name.toLowerCase() === value.trim().toLowerCase());
    if (match) {
      onAdd(date, mealType, match.id);
      setOpen(false);
      setInput("");
    }
  }
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{
          display: "flex", alignItems: "center", gap: 5, color: C.jade700, fontSize: 11.5, fontWeight: 600,
          border: `1.5px dashed ${C.line}`, borderRadius: 9, padding: "8px 10px", width: "100%", justifyContent: "center",
        }}
      >
        <Plus size={13} /> Add a dish{mealType ? ` to ${mealType}` : ""} — unexpected guest, or just want more
      </button>
    );
  }
  const listId = `add-dish-${date}-${mealType || "any"}`;
  return (
    <div>
      <p style={{ fontSize: 10, color: C.inkSoft, margin: "0 0 5px", fontWeight: 600 }}>
        Guest has a restriction? Filter just for this dish (won't change your household settings):
      </p>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
        <Chip active={guestNoPork} onClick={() => setGuestNoPork(v => !v)}>No pork</Chip>
        <Chip active={guestVegetarian} onClick={() => setGuestVegetarian(v => !v)}>Vegetarian only</Chip>
      </div>
      <input
        value={guestAvoid}
        onChange={e => setGuestAvoid(e.target.value)}
        placeholder="Or type an ingredient to avoid (e.g. peanuts)…"
        style={{ width: "100%", border: `1px solid ${C.line}`, borderRadius: 8, padding: "6px 8px", fontFamily: FONT_BODY, fontSize: 11.5, background: C.paper, color: C.ink, marginBottom: 8 }}
      />
      <input
        value={input}
        onChange={e => handleChange(e.target.value)}
        list={listId}
        placeholder="Type to search dishes…"
        autoFocus
        style={{ width: "100%", border: `1px solid ${C.jade600}`, borderRadius: 8, padding: "8px 8px", fontFamily: FONT_BODY, fontSize: 12.5, background: "#F2F6EE", color: C.ink }}
      />
      <datalist id={listId}>
        {(options || []).map(p => (
          <option key={p.id} value={p.name}>{p.custom ? "Yours" : p.cuisine}</option>
        ))}
      </datalist>
      <p style={{ fontSize: 10, color: C.inkSoft, margin: "4px 0 0" }}>
        {guestFilterActive
          ? `Showing only dishes that match the guest filter above. Start typing, then tap a suggestion to add it.`
          : `Start typing, then tap a suggestion to add it.`}
      </p>
      {guestFilterActive && (options || []).length === 0 && (
        <p style={{ fontSize: 10.5, color: C.clayText, margin: "4px 0 0", fontWeight: 600 }}>
          No saved dishes match that filter — try loosening it, or add a new recipe for this guest.
        </p>
      )}
    </div>
  );
}

function Tag({ text }) {
  return (
    <span style={{
      fontSize: 10.5, fontWeight: 600, color: C.jade700, background: "#EAF3EE",
      borderRadius: 6, padding: "2px 7px", fontFamily: FONT_BODY, textTransform: "capitalize",
    }}>{text}</span>
  );
}

function IconBtn({ onClick, children, title }) {
  return (
    <button onClick={onClick} title={title} style={{
      width: 28, height: 28, borderRadius: 8, border: `1px solid ${C.line}`, background: C.paperDim,
      color: C.jade700, display: "flex", alignItems: "center", justifyContent: "center",
    }}>{children}</button>
  );
}

/* ---------------------------------------------------------------
   SHOPPING LIST SCREEN — styled like a receipt
------------------------------------------------------------------*/
function ZigZag({ flip }) {
  return (
    <div style={{
      height: 10, background: `
        linear-gradient(135deg, transparent 6px, ${C.paper} 0) 0 0/12px 12px,
        linear-gradient(-135deg, transparent 6px, ${C.paper} 0) 0 0/12px 12px`,
      backgroundColor: C.jade900,
      transform: flip ? "scaleY(-1)" : "none",
    }} />
  );
}

function ShoppingListScreen({ toBuyByCategory, haveIt, checkedItems, toggleChecked, checkedCount, totalCount, extraItems, addExtraItem, removeExtraItem, hasPlan, targetPax, onMarkUsed, onSwapMeal, onPostponeMeal, canPostponeMeal }) {
  const [manualInput, setManualInput] = useState("");
  const [usedMsg, setUsedMsg] = useState("");

  function handleMarkUsed() {
    onMarkUsed();
    setUsedMsg("Kitchen stock updated — quantities on hand now reflect this week's plan.");
    setTimeout(() => setUsedMsg(""), 4000);
  }

  return (
    <div style={{ padding: "18px 18px 28px" }}>
      {!hasPlan ? (
        <div style={{ padding: "24px 0", textAlign: "center" }}>
          <ShoppingCart size={30} color={C.line} style={{ marginBottom: 10 }} />
          <p style={{ fontFamily: FONT_DISPLAY, fontSize: 17, color: C.ink, marginBottom: 4 }}>No list yet</p>
          <p style={{ fontSize: 12.5, color: C.inkSoft }}>Generate a meal plan and this list writes itself from it.</p>
        </div>
      ) : (
        <>
          <ZigZag />
          <div style={{ background: C.paper, padding: "14px 18px 4px" }}>
            <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: C.inkSoft, letterSpacing: 0.5, display: "flex", justifyContent: "space-between" }}>
              <span>MAKAN LEDGER</span>
              <span>{new Date().toLocaleDateString("en-SG", { day: "2-digit", month: "short" })}</span>
            </div>
            {targetPax > 0 && (
              <div style={{ fontFamily: FONT_MONO, fontSize: 10.5, color: C.jade700, marginTop: 4 }}>
                Quantities scaled to each meal's headcount (default {targetPax} pax) where a recipe has amounts saved
              </div>
            )}
            <div style={{ borderTop: `1.5px dashed ${C.line}`, margin: "10px 0" }} />

            {CATEGORY_ORDER.filter(cat => toBuyByCategory[cat]?.length).map(cat => (
              <div key={cat} style={{ marginBottom: 12 }}>
                <div style={{ fontFamily: FONT_MONO, fontSize: 10.5, fontWeight: 700, color: C.jade700, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 4 }}>
                  {CATEGORY_LABEL[cat]}
                </div>
                {toBuyByCategory[cat].map(item => (
                  <ReceiptRow key={item.key} item={item} checked={!!checkedItems[item.key]} onToggle={() => toggleChecked(item)} onSwapMeal={onSwapMeal} onPostponeMeal={onPostponeMeal} canPostponeMeal={canPostponeMeal} />
                ))}
              </div>
            ))}

            {extraItems.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontFamily: FONT_MONO, fontSize: 10.5, fontWeight: 700, color: C.jade700, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 4 }}>
                  Added by you
                </div>
                {extraItems.map(item => (
                  <div key={item.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "5px 0" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <Checkbox checked={!!checkedItems[item.name.toLowerCase()]} onClick={() => toggleChecked({ key: item.name.toLowerCase(), name: item.name, category: item.category, amount: null, unit: null })} />
                      <span style={{
                        fontFamily: FONT_MONO, fontSize: 13, color: checkedItems[item.name.toLowerCase()] ? C.inkSoft : C.ink,
                        textDecoration: checkedItems[item.name.toLowerCase()] ? "line-through" : "none",
                      }}>{item.name}</span>
                    </div>
                    <button onClick={() => removeExtraItem(item.id)} style={{ color: C.inkSoft }}><X size={13} /></button>
                  </div>
                ))}
              </div>
            )}

            {totalCount === 0 && extraItems.length === 0 && (
              <p style={{ fontSize: 12, color: C.inkSoft, fontStyle: "italic" }}>Everything's already in your kitchen. Nothing to buy!</p>
            )}

            <div style={{ borderTop: `1.5px dashed ${C.line}`, margin: "6px 0 10px" }} />
            <div style={{ display: "flex", gap: 8 }}>
              <input
                value={manualInput}
                onChange={e => setManualInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") { addExtraItem(manualInput); setManualInput(""); } }}
                placeholder="Add another item…"
                style={{ flex: 1, border: `1px solid ${C.line}`, borderRadius: 8, padding: "8px 10px", fontFamily: FONT_MONO, fontSize: 12.5, background: "#fff", color: C.ink }}
              />
              <button
                onClick={() => { addExtraItem(manualInput); setManualInput(""); }}
                style={{ background: C.jade700, color: "#fff", border: "none", borderRadius: 8, padding: "0 12px" }}
              ><Plus size={15} /></button>
            </div>

            <div style={{ borderTop: `1.5px dashed ${C.line}`, margin: "12px 0 8px" }} />
            <div style={{ fontFamily: FONT_MONO, fontSize: 11.5, color: C.inkSoft, display: "flex", justifyContent: "space-between" }}>
              <span>ITEMS TO BUY</span>
              <span>{checkedCount}/{totalCount + extraItems.length}</span>
            </div>
          </div>
          <ZigZag flip />

          <button
            onClick={handleMarkUsed}
            style={{
              width: "100%", marginTop: 14, background: "#fff", border: `1.5px solid ${C.jade700}`, borderRadius: 10,
              padding: "10px 0", color: C.jade700, fontFamily: FONT_BODY, fontWeight: 700, fontSize: 12.5,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
            }}
          >
            <Package size={14} /> Mark this week's plan as cooked
          </button>
          <p style={{ fontSize: 10.5, color: C.inkSoft, marginTop: 6, fontStyle: "italic" }}>
            Deducts what this plan used from kitchen quantities you've set — so bulk-bought stock rolls over instead of resetting.
          </p>
          {usedMsg && <p style={{ fontSize: 11.5, color: C.jade700, fontWeight: 600, marginTop: 6 }}>{usedMsg}</p>}

          {haveIt.length > 0 && (
            <details className="expandable" style={{ marginTop: 16 }}>
              <summary style={{
                fontFamily: FONT_MONO, fontSize: 11.5, fontWeight: 600, color: C.sageText,
                display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6,
                background: "#EAEFE3", borderRadius: 10, padding: "8px 10px",
              }}>
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Package size={13} /> Already in your kitchen ({haveIt.length})
                </span>
                <ChevronDown className="chevron" size={15} color={C.sageText} style={{ flexShrink: 0, transition: "transform .15s" }} />
              </summary>
              <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 6 }}>
                {haveIt.map(i => (
                  <span key={i.key} style={{ fontSize: 11, fontFamily: FONT_MONO, color: C.inkSoft, background: C.paperDim, borderRadius: 6, padding: "3px 8px" }}>
                    {i.name}
                  </span>
                ))}
              </div>
            </details>
          )}
        </>
      )}
    </div>
  );
}

function ReceiptRow({ item, checked, onToggle, onSwapMeal, onPostponeMeal, canPostponeMeal }) {
  const [expanded, setExpanded] = useState(false);
  const refs = item.mealRefs || [];
  return (
    <div style={{ padding: "5px 0" }}>
      <div onClick={onToggle} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <Checkbox checked={checked} />
          <CategoryDot category={item.category} />
          <span style={{
            fontFamily: FONT_MONO, fontSize: 13, color: checked ? C.inkSoft : C.ink,
            textDecoration: checked ? "line-through" : "none",
          }}>{item.name}{item.fromStock && <span style={{ color: C.sageText, fontStyle: "italic" }}> (top up)</span>}</span>
        </div>
        {item.amount != null ? (
          <span style={{ fontFamily: FONT_MONO, fontSize: 11.5, color: C.inkSoft, flexShrink: 0 }}>
            {formatQty(item.amount)} {item.unit}
          </span>
        ) : item.count > 1 && (
          <span style={{ fontFamily: FONT_MONO, fontSize: 11.5, color: C.inkSoft }}>×{item.count}</span>
        )}
      </div>
      {refs.length > 0 && !checked && (
        <div style={{ marginLeft: 30, marginTop: 4 }}>
          <button
            onClick={(e) => { e.stopPropagation(); setExpanded(v => !v); }}
            style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              fontFamily: FONT_BODY, fontSize: 11.5, fontWeight: 600, color: C.clayText, cursor: "pointer",
              background: "#F7E6DC", border: "1px solid #E3C2A8", borderRadius: 999, padding: "4px 10px",
            }}
          >
            <AlertTriangle size={12} /> Can't find this? <span style={{ opacity: 0.7 }}>{expanded ? "▾" : "▸"}</span>
          </button>
          {expanded && (
            <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 5 }}>
              <span style={{ fontFamily: FONT_BODY, fontSize: 10.5, color: C.inkSoft }}>Used in:</span>
              {refs.map(ref => {
                const [y, m, d] = (ref.date || "").split("-").map(Number);
                const dt = ref.date ? new Date(y, m - 1, d) : null;
                const weekday = dt ? dt.toLocaleDateString("en-SG", { weekday: "short" }) : "";
                const canPostpone = canPostponeMeal ? canPostponeMeal(ref.uid) : false;
                return (
                  <div key={ref.uid} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
                    <span style={{
                      fontFamily: FONT_MONO, fontSize: 11, color: C.ink, minWidth: 0, flex: 1,
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>
                      {weekday ? `${weekday} ${ref.mealType} — ${ref.name}` : `${ref.mealType} — ${ref.name}`}
                    </span>
                    <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                      {canPostpone && (
                        <button
                          onClick={(e) => { e.stopPropagation(); onPostponeMeal && onPostponeMeal(ref.uid); setExpanded(false); }}
                          title="Eat later instead — might just be out of stock this week"
                          style={{
                            fontFamily: FONT_BODY, fontSize: 10.5, fontWeight: 600, color: C.jade700, background: "transparent",
                            border: `1px solid ${C.jade700}`, borderRadius: 6, padding: "3px 7px", cursor: "pointer", flexShrink: 0,
                          }}
                        >Later</button>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); onSwapMeal && onSwapMeal(ref.uid, item.name); setExpanded(false); }}
                        title="Leave the ingredient out, or swap the dish if it can't"
                        style={{
                          fontFamily: FONT_BODY, fontSize: 10.5, fontWeight: 600, color: C.paper, background: C.jade700,
                          border: "none", borderRadius: 6, padding: "3px 7px", cursor: "pointer", flexShrink: 0,
                        }}
                      >Fix</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Checkbox({ checked }) {
  return (
    <span style={{
      width: 16, height: 16, borderRadius: 4, border: `1.5px solid ${checked ? C.jade700 : C.line}`,
      background: checked ? C.jade700 : "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
    }}>
      {checked && <Check size={11} color="#fff" strokeWidth={3} />}
    </span>
  );
}

/* ---------------------------------------------------------------
   PANTRY SCREEN
------------------------------------------------------------------*/
function PantryScreen({ pantry, removePantryItem, updatePantryQuantity, toggleUseSoon, updatePantryLocation, togglePantryPreparedForm, clearAllUseSoon, newPantryName, setNewPantryName, newPantryCategory, setNewPantryCategory, newPantryLocation, setNewPantryLocation, newPantryQuantity, setNewPantryQuantity, newPantryUnit, setNewPantryUnit, newPantryUseSoon, setNewPantryUseSoon, addPantryItem }) {
  const [addingIngredient, setAddingIngredient] = useState(false);
  const [pantrySearch, setPantrySearch] = useState("");
  const [editingPantryId, setEditingPantryId] = useState(null);
  const grouped = useMemo(() => {
    const map = {};
    pantry.forEach(p => { const loc = p.location || "pantry"; (map[loc] = map[loc] || []).push(p); });
    return map;
  }, [pantry]);
  const visibleGrouped = Object.fromEntries(Object.entries(grouped).map(([location, items]) => [location, items.filter(item => item.name.toLowerCase().includes(pantrySearch.trim().toLowerCase()))]));

  return (
    <div style={{ padding: "22px 18px 32px", background:"#FAF7F2", minHeight:"70vh" }}>
      <div style={{background:"linear-gradient(125deg,#294B3F,#456D55 65%,#779477)",borderRadius:24,padding:"25px 22px",color:"#fff",marginBottom:22,position:"relative",overflow:"hidden",boxShadow:"0 12px 28px rgba(36,68,53,.16)"}}>
        <div style={{position:"absolute",right:-20,top:-28,fontSize:116,opacity:.18,transform:"rotate(-16deg)",pointerEvents:"none"}}>🥬</div>
        <div style={{fontSize:11,letterSpacing:2.2,fontWeight:800,color:"#D9EBCF",marginBottom:10}}>YOUR LITTLE FOOD HAVEN</div>
        <div style={{fontFamily:FONT_DISPLAY,fontSize:34,lineHeight:1.08,maxWidth:230,marginBottom:12}}>Good food starts here.</div>
        <div style={{fontSize:13,color:"#F1F4EA",maxWidth:265,lineHeight:1.6}}>{pantry.length} ingredients ready for your next meal · {pantry.filter(p=>p.useSoon).length} to use soon</div>
      </div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14,gap:12}}><div><h2 style={{fontFamily:FONT_DISPLAY,fontSize:28,margin:"0 0 3px"}}>My kitchen</h2><span style={{fontSize:13,color:C.inkSoft}}>{pantry.length} ingredients on hand</span></div><button onClick={()=>setAddingIngredient(v=>!v)} aria-expanded={addingIngredient} style={{background:"#E9A28F",border:0,borderRadius:14,padding:"12px 14px",fontWeight:800,color:C.ink}}>{addingIngredient?"Close":"＋ Add"}</button></div>
      {addingIngredient && <div style={{background:"#fff",border:"1px solid #E9E3DF",borderRadius:20,padding:16,marginBottom:20}}><SectionLabel>Add an ingredient</SectionLabel>
      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        <input
          value={newPantryName}
          onChange={e => setNewPantryName(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") addPantryItem(); }}
          placeholder="e.g. Dried noodles, or chicken thigh you got on sale"
          style={{ flex: 1, border: `1px solid ${C.line}`, borderRadius: 8, padding: "9px 10px", fontFamily: FONT_BODY, fontSize: 13, background: "#fff", color: C.ink }}
        />
        <button onClick={addPantryItem} style={{ background: C.mustard, border: "none", borderRadius: 8, padding: "0 12px", color: C.jade900 }}>
          <Plus size={16} />
        </button>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <Chip active={newPantryUseSoon} onClick={() => setNewPantryUseSoon(v => !v)}>Use soon</Chip>
        <span style={{ fontSize: 10.5, color: C.inkSoft, lineHeight: 1.3 }}>
          A staple and something bought on sale can be the same thing — toggle this on and the generator will prioritize it.
        </span>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        <input
          type="number"
          value={newPantryQuantity}
          onChange={e => setNewPantryQuantity(e.target.value)}
          placeholder="Qty (optional)"
          style={{ flex: 2, minWidth: 0, border: `1px solid ${C.line}`, borderRadius: 8, padding: "9px 10px", fontFamily: FONT_MONO, fontSize: 12.5, background: "#fff", color: C.ink }}
        />
        <input
          value={newPantryUnit}
          onChange={e => setNewPantryUnit(e.target.value)}
          placeholder="kg, pcs…"
          style={{ flex: 1, minWidth: 0, maxWidth: 90, border: `1px solid ${C.line}`, borderRadius: 8, padding: "9px 10px", fontFamily: FONT_MONO, fontSize: 12.5, background: "#fff", color: C.ink }}
        />
      </div>
      <p style={{ fontSize: 10.5, color: C.inkSoft, marginTop: -4, marginBottom: 10, fontStyle: "italic" }}>
        Leave quantity blank for "I always have this." Set a quantity when you bulk-buy something on sale —
        it'll only ask you to top it up once you're running low, not the moment you have any at all.
      </p>

      <div style={{ fontSize: 11.5, fontWeight: 600, color: C.inkSoft, marginBottom: 6 }}>Where it's stored</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
        {LOCATIONS.map(loc => (
          <Chip key={loc.id} active={newPantryLocation === loc.id} onClick={() => setNewPantryLocation(loc.id)}>{loc.label}</Chip>
        ))}
      </div>

      <div style={{ fontSize: 11.5, fontWeight: 600, color: C.inkSoft, marginBottom: 6 }}>Category</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 20 }}>
        {CATEGORY_ORDER.map(cat => (
          <Chip key={cat} active={newPantryCategory === cat} onClick={() => setNewPantryCategory(cat)}>{CATEGORY_LABEL[cat]}</Chip>
        ))}
      </div>

      </div>}
      <input aria-label="Search your ingredients" placeholder="Search your ingredients…" value={pantrySearch} onChange={e=>setPantrySearch(e.target.value)} style={{...fieldStyle,background:"#fff",borderRadius:14,padding:"12px 14px",marginBottom:16}} />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <SectionLabel>Stored ingredients ({pantry.length})</SectionLabel>
        {pantry.some(p => p.useSoon) && (
          <button onClick={clearAllUseSoon} style={{ fontSize: 10.5, color: C.clayText, fontWeight: 700, marginBottom: 8 }}>
            Clear all "use soon"
          </button>
        )}
      </div>
      {pantry.some(p=>p.useSoon) && <div style={{background:"#FFF0E7",border:"1px solid #F4D4C6",borderRadius:18,padding:"15px 17px",marginBottom:18}}><div style={{fontWeight:800,fontSize:13,color:"#A7533D",marginBottom:7}}>✦ Cook these first</div><div style={{display:"flex",flexWrap:"wrap",gap:7}}>{pantry.filter(p=>p.useSoon).map(p=><span key={p.id} style={{background:"#fff",borderRadius:999,padding:"7px 11px",fontSize:12,fontWeight:650}}>{p.name}</span>)}</div></div>}

      {LOCATIONS.filter(loc => visibleGrouped[loc.id]?.length).map(loc => (
        <details className="expandable" key={loc.id} open style={{ marginBottom: 14, background:"#fff",borderRadius:20,padding:"7px 15px",border:"1px solid #ECE5DD",boxShadow:"0 5px 18px rgba(65,47,34,.035)" }}>
          <summary style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            background: "#fff", borderRadius: 14, padding: "14px 2px", marginBottom: 0,
          }}>
            <span style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: FONT_MONO, fontSize: 11, fontWeight: 700, color: C.jade700, textTransform: "uppercase", letterSpacing: 0.6 }}>
              {loc.label}
              <span style={{
                fontFamily: FONT_MONO, fontSize: 10, fontWeight: 700, color: C.jade700,
                background: "#EAF3EE", borderRadius: 999, padding: "1px 7px", textTransform: "none", letterSpacing: 0,
              }}>{visibleGrouped[loc.id].length}</span>
            </span>
            <ChevronDown className="chevron" size={15} color={C.jade700} style={{ flexShrink: 0, transition: "transform .15s" }} />
          </summary>
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {visibleGrouped[loc.id].map(item => (
              <div key={item.id} style={{
                display: "flex", flexDirection: "column", gap: 3,
                background: "#fff", borderBottom: "1px solid #F0EBE5", borderRadius: 0, padding: "11px 2px",
              }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
                  <div style={{ display: "flex", alignItems: "center", minWidth: 0, gap: 6 }}>
                    <CategoryDot category={item.category} />
                    <span style={{ fontSize: 13, color: C.ink, fontFamily: FONT_BODY, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name}</span>
                  </div>
                  <button aria-label={`Edit ${item.name}`} aria-expanded={editingPantryId === item.id} onClick={() => setEditingPantryId(v => v === item.id ? null : item.id)} style={{ color: "#806C61", flexShrink: 0, border: "none",background:editingPantryId===item.id?"#F7EEE9":"transparent",borderRadius:999,padding:"7px 10px",fontSize:17,fontWeight:700 }}>
                    {editingPantryId === item.id ? "✓" : "›"}
                  </button>
                </div>
                <div style={{ fontSize: 11.5, color: C.inkSoft,paddingLeft:17 }}>{item.quantity != null ? `${item.quantity} ${item.unit || ""}` : "Always on hand"}{item.useSoon ? " · ✦ Use soon" : ""}{(item.preparedForms || []).length ? ` · Prepared: ${(item.preparedForms || []).join(", ")}` : ""}</div>
                {editingPantryId === item.id && <div style={{ display: "flex", flexDirection:"column", gap: 9 }}>
                  <div><div style={{fontSize:11,fontWeight:800,color:C.inkSoft,marginBottom:6}}>Already prepared as (optional)</div><div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{PREP_FORMS.map(form => <button key={form} type="button" aria-pressed={(item.preparedForms || []).includes(form)} onClick={()=>togglePantryPreparedForm(item.id,form)} style={{padding:"6px 9px",borderRadius:999,fontSize:11,border:"1px solid #DCD5CC",background:(item.preparedForms || []).includes(form)?"#365C4B":"#fff",color:(item.preparedForms || []).includes(form)?"#fff":"#514C49"}}>{form}</button>)}</div><p style={{fontSize:10,color:C.inkSoft,margin:"6px 0 0"}}>Only matching recipe cuts skip prep. Stock availability stays separate.</p></div><div style={{display:"flex",alignItems:"center",flexWrap:"wrap",gap:6}}>
                  <button
                    onClick={() => toggleUseSoon(item.id)}
                    style={{
                      fontSize: 9.5, fontWeight: 700, borderRadius: 999, padding: "2px 7px", flexShrink: 0,
                      background: item.useSoon ? C.clay : "transparent", color: item.useSoon ? "#fff" : C.inkSoft,
                      border: `1px solid ${item.useSoon ? C.clay : C.line}`,
                    }}
                  >
                    use soon
                  </button>
                  <select
                    value={item.location || "pantry"}
                    onChange={e => updatePantryLocation(item.id, e.target.value)}
                    style={{ border: `1px solid ${C.line}`, borderRadius: 6, padding: "3px 2px", fontFamily: FONT_MONO, fontSize: 10, color: C.inkSoft, background: "#fff", flexShrink: 0 }}
                  >
                    {LOCATIONS.map(loc => <option key={loc.id} value={loc.id}>{loc.label}</option>)}
                  </select>
                  {item.quantity != null ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                      <input
                        type="number"
                        value={item.quantity}
                        onChange={e => updatePantryQuantity(item.id, e.target.value)}
                        style={{ width: 44, border: `1px solid ${C.line}`, borderRadius: 6, padding: "4px 5px", fontFamily: FONT_MONO, fontSize: 11.5, background: C.paperDim, color: C.ink }}
                      />
                      <span style={{ fontSize: 10.5, color: C.inkSoft, fontFamily: FONT_MONO }}>{item.unit}</span>
                    </div>
                  ) : (
                    <span style={{ fontSize: 10, color: C.inkSoft, fontFamily: FONT_MONO, fontStyle: "italic" }}>always have</span>
                  )}
                  <button onClick={() => { removePantryItem(item.id); setEditingPantryId(null); }} style={{ fontSize: 12, color: C.clayText, padding: "6px 8px" }}>Remove ingredient</button>
                </div></div>}
              </div>
            ))}
          </div>
        </details>
      ))}

      {pantry.length === 0 && (
        <div style={{background:"#fff",borderRadius:22,border:"1px solid #E9E3DF",padding:"42px 20px",textAlign:"center",marginTop:20}}><div style={{fontSize:38}}>🥬</div><h3 style={{fontFamily:FONT_DISPLAY,fontSize:23,margin:"10px 0 6px"}}>Your kitchen starts here</h3><p style={{fontSize:13,color:C.inkSoft}}>Add what you already have, and your meal plans can make better use of it.</p><button onClick={()=>setAddingIngredient(true)} style={{border:0,background:"#E9A28F",borderRadius:13,padding:"12px 18px",fontWeight:700}}>＋ Add an ingredient</button></div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------
   IMPORT SCREEN — fully manual entry (recipe text is just a reference scratchpad)
------------------------------------------------------------------*/
/* ---------------------------------------------------------------
   HOUSEHOLD SCREEN
------------------------------------------------------------------*/
function HouseholdScreen({
  household, toggleDiet, setHouseholdCount, setDishesPerMealRange, toggleHouseholdList, addDislike, removeDislike,
  syncSettings, setSyncField, syncStatus, onPushToCloud, onPullFromCloud, onRestartTour,
}) {
  const totalPax = household.adults + household.kids + household.elderly;
  const [dislikeInput, setDislikeInput] = useState("");
  const [substituteInput, setSubstituteInput] = useState("");

  return (
    <div style={{ padding: "24px 18px 36px",background:"#FAF7F2",minHeight:"70vh" }}>
      <div style={{background:"linear-gradient(125deg,#534A72,#82769F)",color:"#fff",borderRadius:24,padding:"26px 22px",marginBottom:18,position:"relative",overflow:"hidden"}}><div style={{position:"absolute",right:-10,top:5,fontSize:96,opacity:.16,pointerEvents:"none"}}>🏡</div><div style={{fontSize:11,fontWeight:800,letterSpacing:2,color:"#EAE4FF",marginBottom:9}}>MADE FOR YOUR TABLE</div><h2 style={{fontFamily:FONT_DISPLAY,fontSize:32,lineHeight:1.1,margin:"0 0 12px",maxWidth:250}}>Everyone eats happy.</h2><div style={{fontSize:13,lineHeight:1.6,color:"#F4F0FF"}}>{totalPax} people · {household.dishesPerMealMin}–{household.dishesPerMealMax} dishes per meal</div></div>
      <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:18}}>{[`${household.adults} adults`,`${household.kids} kids`,`${household.elderly} elderly`].filter(x=>!x.startsWith("0 ")).map(x=><span key={x} style={{background:"#F2EBF6",border:"1px solid #E6DAEF",borderRadius:999,padding:"10px 14px",fontSize:13,fontWeight:700,color:"#584B70"}}>{x}</span>)}</div>
      <details style={{background:"#fff",borderRadius:18,padding:"16px 18px",marginBottom:14,border:"1px solid #E9E3DF"}}><summary style={{fontWeight:800,fontSize:15,cursor:"pointer"}}>Adjust people & portions <span style={{float:"right",color:"#887A91"}}>＋</span></summary><div style={{paddingTop:18}}>
      <SectionLabel>Who's eating</SectionLabel>
      <Stepper label="Adults" value={household.adults} min={0} max={12} onChange={v => setHouseholdCount("adults", v)} />
      <Stepper label="Kids" value={household.kids} min={0} max={12} onChange={v => setHouseholdCount("kids", v)} />
      <Stepper label="Elderly" value={household.elderly} min={0} max={12} onChange={v => setHouseholdCount("elderly", v)} />

      <div style={{
        marginTop: 4, marginBottom: 20, fontFamily: FONT_MONO, fontSize: 12, color: C.inkSoft,
        display: "flex", alignItems: "center", gap: 6,
      }}>
        <Users size={13} color={C.jade700} />
        <span>{totalPax} pax total</span>
      </div>

      <SectionLabel>How you eat</SectionLabel>
      <Stepper
        label="Dishes per meal — minimum"
        value={household.dishesPerMealMin}
        min={1} max={6}
        onChange={v => setDishesPerMealRange("min", v)}
      />
      <Stepper
        label="Dishes per meal — maximum"
        value={household.dishesPerMealMax}
        min={1} max={6}
        onChange={v => setDishesPerMealRange("max", v)}
      />
      <p style={{ fontSize: 10.5, color: C.inkSoft, marginTop: -8, marginBottom: 20, lineHeight: 1.4 }}>
        {household.dishesPerMealMin === household.dishesPerMealMax
          ? <>Set the same number for both to always aim for exactly {household.dishesPerMealMax} dish{household.dishesPerMealMax > 1 ? "es" : ""}. A couple might just want one all-in-one dish; a bigger household eating family-style might set both to 4 or 5.</>
          : <>A big family eating family-style can set a range like {household.dishesPerMealMin}–{household.dishesPerMealMax}. Rich, already-filling mains (curry, rendang, and the like) aim for the low end since they don't need much padding out; lighter mains aim for the high end so the table still gets the variety.</>}
      </p>
      </div></details>
      <SettingsSection
        title="Dietary needs"
        countLabel={household.diets.length ? `${household.diets.length} set` : null}
        defaultOpen={false}
      >
        <p style={{ fontSize: 11.5, color: C.inkSoft, marginTop: 0, marginBottom: 12 }}>
          These apply to every plan you generate — meals get swapped or filtered to fit.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {DIET_OPTIONS.map(opt => {
            const active = household.diets.includes(opt.id);
            return (
              <button
                key={opt.id}
                onClick={() => toggleDiet(opt.id)}
                style={{
                  textAlign: "left", border: `1.5px solid ${active ? C.jade700 : C.line}`,
                  background: active ? "#EAF3EE" : "#fff", borderRadius: 12, padding: "12px 14px",
                  display: "flex", gap: 10, alignItems: "flex-start",
                }}
              >
                <Checkbox checked={active} />
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13.5, color: C.ink, fontFamily: FONT_BODY }}>{opt.label}</div>
                  <div style={{ fontSize: 11.5, color: C.inkSoft, marginTop: 2, lineHeight: 1.4 }}>{opt.blurb}</div>
                </div>
              </button>
            );
          })}
        </div>
      </SettingsSection>

      <SettingsSection
        title="Ingredients to avoid"
        countLabel={household.dislikedIngredients.length ? `${household.dislikedIngredients.length} excluded` : null}
        defaultOpen={false}
      >
        <p style={{ fontSize: 11.5, color: C.inkSoft, marginTop: 0, marginBottom: 10 }}>
          Nobody eats this, but the dish otherwise works — so we swap it out instead of skipping the whole recipe.
          Leave "swap with" blank to just drop it.
        </p>
        <div style={{ display: "flex", gap: 8, marginBottom: 6 }}>
          <input
            value={dislikeInput}
            onChange={e => setDislikeInput(e.target.value)}
            placeholder="e.g. okra"
            style={{ flex: 1, border: `1px solid ${C.line}`, borderRadius: 8, padding: "9px 10px", fontFamily: FONT_BODY, fontSize: 13, background: "#fff", color: C.ink }}
          />
          <input
            value={substituteInput}
            onChange={e => setSubstituteInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") { addDislike(dislikeInput, substituteInput); setDislikeInput(""); setSubstituteInput(""); } }}
            placeholder="swap with (optional)"
            style={{ flex: 1, border: `1px solid ${C.line}`, borderRadius: 8, padding: "9px 10px", fontFamily: FONT_BODY, fontSize: 13, background: "#fff", color: C.ink }}
          />
        </div>
        <button
          onClick={() => { addDislike(dislikeInput, substituteInput); setDislikeInput(""); setSubstituteInput(""); }}
          style={{ display: "flex", alignItems: "center", gap: 5, color: C.jade700, fontSize: 12, fontWeight: 600, marginBottom: 10 }}
        >
          <Plus size={13} /> Add
        </button>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {household.dislikedIngredients.length === 0 ? (
            <p style={{ fontSize: 12, color: C.inkSoft, fontStyle: "italic" }}>Nothing excluded yet.</p>
          ) : household.dislikedIngredients.map(d => (
            <div key={d.id} style={{
              display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
              background: "#F7E6DC", borderRadius: 9, padding: "8px 10px 8px 12px",
            }}>
              <span style={{ fontSize: 12.5, color: C.clayText, fontWeight: 600, fontFamily: FONT_BODY }}>
                {d.name}{d.substitute ? ` → ${d.substitute}` : " (dropped, no swap)"}
              </span>
              <button onClick={() => removeDislike(d.id)} style={{ color: C.clay, display: "flex", flexShrink: 0 }}><X size={13} /></button>
            </div>
          ))}
        </div>
      </SettingsSection>

      <SettingsSection
        title="Taste preferences"
        countLabel={(household.preferredCuisines.length + household.preferredProteins.length) ? `${household.preferredCuisines.length + household.preferredProteins.length} set` : null}
        defaultOpen={household.preferredCuisines.length + household.preferredProteins.length > 0}
      >
        <p style={{ fontSize: 11.5, color: C.inkSoft, marginTop: 0, marginBottom: 10 }}>
          Optional — narrows the built-in idea pool to these. Leave blank for no restriction.
          Recipes you've saved from links are never filtered out by this, since you already chose them.
        </p>
        <div style={{ fontSize: 11.5, fontWeight: 600, color: C.inkSoft, marginBottom: 6 }}>Cuisine</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
          {CUISINES.map(c => (
            <Chip key={c} active={household.preferredCuisines.includes(c)} onClick={() => toggleHouseholdList("preferredCuisines", c)}>{c}</Chip>
          ))}
        </div>
        <div style={{ fontSize: 11.5, fontWeight: 600, color: C.inkSoft, marginBottom: 6 }}>Protein</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {PROTEINS.map(p => (
            <Chip key={p} active={household.preferredProteins.includes(p)} onClick={() => toggleHouseholdList("preferredProteins", p)}>{p}</Chip>
          ))}
        </div>
      </SettingsSection>


      <SettingsSection title="Help" defaultOpen={false} last>
        <p style={{ fontSize: 11.5, color: C.inkSoft, marginTop: 0, marginBottom: 10, lineHeight: 1.4 }}>
          New here, or want a refresher on how the app fits together?
        </p>
        <button
          onClick={onRestartTour}
          style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6, width: "100%",
            background: "#fff", color: C.jade700, border: `1.5px solid ${C.jade700}`, borderRadius: 10,
            padding: "10px 0", fontFamily: FONT_BODY, fontWeight: 700, fontSize: 12.5,
          }}
        >
          <Sparkles size={14} /> Replay the walkthrough
        </button>
      </SettingsSection>
    </div>
  );
}

// Collapsible settings group — the household screen keeps growing (dietary
// needs, dislikes, taste prefs, and whatever comes next), so the two
// settings people touch constantly (household size, dishes per meal) stay
// always open, while the more occasional ones collapse by default and only
// open automatically once something's actually been set in them. The count
// badge means a glance at the closed header still shows what's configured,
// without needing to open it to check.
// A bare uppercase label reads as a heading, not a button — nothing said
// "tap me" until you'd already tried. A chevron is the one icon almost
// everyone already reads as "there's more here", so it does the explaining
// instead of the label having to; the "settings-section" class picks up the
// rotate-on-open rule from the global stylesheet below.
function SettingsSection({ title, countLabel, defaultOpen, last, children }) {
  return (
    <details className="expandable" open={defaultOpen} style={{ marginBottom: last ? 0 : 22 }}>
      <summary style={{
        display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer",
        listStyle: "none", marginBottom: 4, background: C.paperDim, borderRadius: 10, padding: "10px 12px",
      }}>
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{
            fontFamily: FONT_MONO, fontSize: 10.5, fontWeight: 600, color: C.inkSoft,
            textTransform: "uppercase", letterSpacing: 0.8,
          }}>{title}</span>
          {countLabel && (
            <span style={{
              fontFamily: FONT_MONO, fontSize: 10, fontWeight: 700, color: C.jade700,
              background: "#EAF3EE", borderRadius: 999, padding: "2px 8px",
            }}>{countLabel}</span>
          )}
        </span>
        <ChevronDown className="chevron" size={16} color={C.jade700} style={{ flexShrink: 0, transition: "transform .15s" }} />
      </summary>
      <div style={{ paddingTop: 10 }}>{children}</div>
    </details>
  );
}

function ImportScreen({ myRecipes, saveRecipe, deleteRecipe, household, draft, setDraft, libraryEdit, setLibraryEdit, libraryIntent, clearLibraryIntent }) {
  const [error, setError] = useState("");
  const [ingredientPaste, setIngredientPaste] = useState("");
  const [recipeTextPaste, setRecipeTextPaste] = useState("");
  const [showTextImporter, setShowTextImporter] = useState(false);

  const householdPax = household.adults + household.kids + household.elderly;

  // Cuisine suggestions: built-in list plus anything already typed and saved,
  // so a correctly-spelled custom cuisine becomes a pick-again suggestion
  // instead of something re-typed (and possibly mis-typed) every time.
  const cuisineSuggestions = useMemo(() => {
    const seen = new Map();
    [...CUISINES, ...myRecipes.map(r => r.cuisine)].forEach(c => {
      if (c && !seen.has(c.toLowerCase())) seen.set(c.toLowerCase(), c);
    });
    return [...seen.values()];
  }, [myRecipes]);

  // Component recipes already saved (sambal, curry roux, a spice paste...) —
  // these are the only things an ingredient row can link to instead of
  // being typed in as a plain bought item.
  const componentRecipes = useMemo(() => myRecipes.filter(r => r.isComponent), [myRecipes]);

  // Browsing the saved-recipes list "at a glance" once it's grown past a
  // handful — type-to-search plus quick filter chips, built from whatever
  // cuisines/proteins you've actually saved rather than a fixed list, so it
  // stays relevant instead of showing chips for cuisines you don't cook.
  const [recipeQuery, setRecipeQuery] = useState("");
  const [recipeFilterType, setRecipeFilterType] = useState("all"); // all | main | side | component
  const [recipeFilterCuisine, setRecipeFilterCuisine] = useState(null);
  const [recipeFilterProtein, setRecipeFilterProtein] = useState(null);
  const savedCuisines = useMemo(() => [...new Set(myRecipes.map(r => r.cuisine).filter(Boolean))].sort(), [myRecipes]);
  const savedProteins = useMemo(() => [...new Set(myRecipes.map(r => r.protein).filter(Boolean))].sort(), [myRecipes]);
  const filteredRecipes = useMemo(() => {
    return myRecipes.filter(r => {
      if (recipeQuery.trim() && !r.name.toLowerCase().includes(recipeQuery.trim().toLowerCase())) return false;
      if (recipeFilterType === "main" && (r.side || r.isComponent)) return false;
      if (recipeFilterType === "side" && (!r.side || r.isComponent)) return false;
      if (recipeFilterType === "component" && !r.isComponent) return false;
      if (recipeFilterCuisine && r.cuisine !== recipeFilterCuisine) return false;
      if (recipeFilterProtein && r.protein !== recipeFilterProtein) return false;
      return true;
    });
  }, [myRecipes, recipeQuery, recipeFilterType, recipeFilterCuisine, recipeFilterProtein]);

  function blankDraft() {
    return {
      name: "", cuisine: CUISINES[0], protein: PROTEINS[0], time: 30, soft: false, side: false,
      isComponent: false, yieldAmount: "", yieldUnit: "",
      mealTypes: ["lunch", "dinner"], baseServings: 4,
      ingredients: [{ id: "d" + Date.now(), name: "", category: "other", amount: null, unit: "", componentId: null }],
      steps: [""],
      sourceNote: "",
      creatorName: "", creatorUrl: "", videoUrl: "",
      photo: null,
    };
  }

  function updateDraftIngredient(id, field, value) {
    setDraft(prev => ({ ...prev, ingredients: prev.ingredients.map(i => i.id === id ? { ...i, [field]: value } : i) }));
  }
  function removeDraftIngredient(id) {
    setDraft(prev => ({ ...prev, ingredients: prev.ingredients.filter(i => i.id !== id) }));
  }
  function addDraftIngredient() {
    setDraft(prev => ({ ...prev, ingredients: [...prev.ingredients, { id: "d" + Date.now(), name: "", category: "other", amount: null, unit: "", componentId: null }] }));
  }
  // Swaps an ingredient row between "plain, bought" and "linked to a
  // component recipe I already saved" — linking fills in the name and
  // category from that recipe so the two stay in sync, and clearing it
  // (recipeId falsy) goes back to a normal free-text ingredient.
  function linkIngredientToComponent(id, recipeId) {
    const comp = recipeId ? componentRecipes.find(r => r.id === recipeId) : null;
    setDraft(prev => ({
      ...prev,
      ingredients: prev.ingredients.map(i => i.id === id
        ? { ...i, componentId: comp ? comp.id : null, name: comp ? comp.name : "", category: comp ? "seasoning" : i.category }
        : i),
    }));
  }
  function toggleDraftMealType(type) {
    setDraft(prev => {
      const has = prev.mealTypes.includes(type);
      if (has && prev.mealTypes.length === 1) return prev;
      return { ...prev, mealTypes: has ? prev.mealTypes.filter(t => t !== type) : [...prev.mealTypes, type] };
    });
  }
  function updateDraftStep(index, value) {
    setDraft(prev => ({ ...prev, steps: prev.steps.map((s, i) => i === index ? value : s) }));
  }
  function removeDraftStep(index) {
    setDraft(prev => ({ ...prev, steps: prev.steps.filter((_, i) => i !== index) }));
  }
  function addDraftStep() {
    setDraft(prev => ({ ...prev, steps: [...prev.steps, ""] }));
  }

  // Photos are auto-compressed before they ever touch storage: whatever
  // comes off the camera or gallery gets redrawn onto a canvas capped at
  // 480px wide and re-exported as a JPEG at 72% quality, which turns a
  // multi-MB phone photo into roughly 20-50KB — small enough that a whole
  // recipe collection of photos stays well inside the app's storage budget.
  // The person never sees this step; they just pick a photo and it's done.
  const MAX_RECIPE_PHOTO_WIDTH = 480;
  function handleDraftPhotoSelected(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, MAX_RECIPE_PHOTO_WIDTH / img.width);
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.72);
        setDraft(prev => ({ ...prev, photo: dataUrl }));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  }
  function removeDraftPhoto() {
    setDraft(prev => ({ ...prev, photo: null }));
  }

  function importRecipeText() {
    const raw = recipeTextPaste.trim();
    if (!raw) return;
    const lines = raw.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
    let section = "intro";
    const ingredients = [], steps = [];
    let name = "";
    for (const line of lines) {
      if (/^(ingredients?|what you need)\s*:?$/i.test(line)) {section="ingredients";continue;}
      if (/^(instructions?|method|directions?|steps?|how to cook)\s*:?$/i.test(line)) {section="steps";continue;}
      if (!name && section==="intro" && !/^(https?:|@|#)/.test(line)) {name=line.replace(/^recipe\s*:\s*/i,"").slice(0,100);continue;}
      if (section==="ingredients") {
        const cleaned=line.replace(/^[-•*]\s*/,"");
        const m=cleaned.match(/^(\d+(?:\.\d+)?|\d+\/\d+)\s*(kg|g|ml|l|tbsp|tsp|cups?|pcs?|pieces?|cloves?)?\s+(.+)$/i);
        const amount=m?(m[1].includes("/")?Number(m[1].split("/")[0])/Number(m[1].split("/")[1]):Number(m[1])):null;
        ingredients.push({id:"import-"+Date.now()+"-"+ingredients.length,name:m?m[3]:cleaned,category:"other",amount,unit:m?(m[2]||""):"",componentId:null});
      } else if (section==="steps") {steps.push(line.replace(/^(?:\d+[.)]|[-•*])\s*/,""));}
    }
    if (!ingredients.length) {setError("Add an Ingredients heading and list ingredients on separate lines. Add a Steps heading for instructions.");return;}
    setDraft(prev=>({...prev,name:name||prev?.name||"",ingredients,steps:steps.length?steps:[""],sourceNote:raw.slice(0,3000)}));
    setShowTextImporter(false);setRecipeTextPaste("");setError("");
  }

  function addPastedIngredients() {
    const lines = ingredientPaste.split(/\r?\n|;/).map(x => x.trim()).filter(Boolean);
    if (!lines.length) return;
    const items = lines.map((line, i) => {
      const match = line.match(/^(\d+(?:\.\d+)?|\d+\/\d+)\s*(kg|g|ml|l|tbsp|tsp|cups?|pcs?|pieces?|cloves?)?\s+(.+)$/i);
      const amount = match ? (match[1].includes("/") ? Number(match[1].split("/")[0]) / Number(match[1].split("/")[1]) : Number(match[1])) : null;
      return { id: "paste-" + Date.now() + "-" + i, name: match ? match[3].trim() : line, category: "other", amount, unit: match ? (match[2] || "") : "", componentId: null };
    });
    setDraft(prev => ({ ...prev, ingredients: [...prev.ingredients.filter(i => i.name.trim()), ...items] }));
    setIngredientPaste("");
  }

  function handleSave() {
    const cleanIngredients = draft.ingredients.filter(i => i.name.trim());
    const cleanSteps = draft.steps.map(s => s.trim()).filter(Boolean);
    if (!draft.name.trim() || cleanIngredients.length === 0) {
      setError("Give the recipe a name and at least one ingredient before saving.");
      return;
    }
    if (draft.isComponent && (!draft.yieldAmount || Number(draft.yieldAmount) <= 0 || !draft.yieldUnit.trim())) {
      setError("Say how much one batch makes (amount and unit) so batches can be worked out for you.");
      return;
    }
    saveRecipe({
      id: draft.id || undefined,
      name: draft.name.trim(),
      cuisine: draft.cuisine,
      protein: draft.protein,
      time: draft.time,
      soft: draft.soft,
      side: draft.side,
      isComponent: draft.isComponent,
      yieldAmount: draft.isComponent ? Number(draft.yieldAmount) : null,
      yieldUnit: draft.isComponent ? draft.yieldUnit.trim() : "",
      mealTypes: draft.mealTypes,
      baseServings: draft.baseServings,
      ingredients: cleanIngredients.map(i => ({
        name: i.name.trim(), category: i.category,
        amount: i.amount === "" || i.amount == null ? null : Number(i.amount),
        unit: i.unit || "",
        componentId: i.componentId || null,
      })),
      steps: cleanSteps,
      sourceNote: draft.sourceNote.trim(),
      creatorName: (draft.creatorName || "").trim(),
      creatorUrl: safeUrl(draft.creatorUrl),
      videoUrl: safeUrl(draft.videoUrl),
      photo: draft.photo || null,
    });
    setDraft(null);
    setError("");
  }

  function handleCancelDraft() {
    setDraft(null);
    setError("");
    if (setLibraryEdit) setLibraryEdit(false);
  }
  // The admin pressed "New library recipe" / "Edit" on the Library tab.
  useEffect(() => {
    if (!libraryIntent) return;
    setDraft(libraryIntent.recipe ? draftFromRecipe(libraryIntent.recipe) : blankDraft());
    setError("");
    if (clearLibraryIntent) clearLibraryIntent();
  }, [libraryIntent]); // eslint-disable-line react-hooks/exhaustive-deps

  // Loads an already-saved recipe back into the same form used for adding
  // one, so changing a recipe means editing it in place instead of
  // deleting it and starting over from scratch.
  function draftFromRecipe(recipe) {
    return {
      id: recipe.id,
      name: recipe.name, cuisine: recipe.cuisine, protein: recipe.protein, time: recipe.time,
      soft: !!recipe.soft, side: !!recipe.side,
      isComponent: !!recipe.isComponent,
      yieldAmount: recipe.yieldAmount != null ? String(recipe.yieldAmount) : "",
      yieldUnit: recipe.yieldUnit || "",
      mealTypes: recipe.mealTypes && recipe.mealTypes.length ? recipe.mealTypes : ["lunch", "dinner"],
      baseServings: recipe.baseServings || 4,
      ingredients: (recipe.ingredients && recipe.ingredients.length ? recipe.ingredients : [{ name: "", category: "other", amount: null, unit: "" }])
        .map(i => ({ id: "d" + Date.now() + Math.random().toString(36).slice(2, 6), name: i.name, category: i.category, amount: i.amount, unit: i.unit || "", componentId: i.componentId || null })),
      steps: recipe.steps && recipe.steps.length ? [...recipe.steps] : [""],
      sourceNote: recipe.sourceNote || "",
      creatorName: recipe.creatorName || "", creatorUrl: recipe.creatorUrl || "", videoUrl: recipe.videoUrl || "",
      photo: recipe.photo || null,
    };
  }
  function handleEditRecipe(recipe) {
    setDraft(draftFromRecipe(recipe));
    setError("");
  }


  return (
    <div style={{ padding: "24px 18px 36px",background:"#FAF7F2",minHeight:"70vh" }}>
      <div style={{background:"linear-gradient(125deg,#8F554D,#C88B79)",color:"#fff",borderRadius:24,padding:"25px 22px",marginBottom:20,position:"relative",overflow:"hidden"}}><div style={{position:"absolute",right:-10,top:-10,fontSize:105,opacity:.19,pointerEvents:"none"}}>📖</div><div style={{fontSize:11,fontWeight:800,letterSpacing:2,color:"#FFE5D8",marginBottom:9}}>YOUR FAMILY FAVOURITES</div><h2 style={{fontFamily:FONT_DISPLAY,fontSize:33,lineHeight:1.1,margin:"0 0 11px",maxWidth:240}}>Recipes worth keeping.</h2><div style={{fontSize:13,color:"#FFF3EC"}}>{myRecipes.length} saved recipes · Private to you</div></div>
      {!draft && <p style={{fontSize:13,color:C.inkSoft,margin:"0 0 12px"}}>Your saved recipes, ready when you need them.</p>}

      {!draft && <div style={{marginBottom:14}}><button onClick={()=>setShowTextImporter(v=>!v)} style={{width:"100%",background:"#365C4B",color:"#fff",borderRadius:14,padding:"14px",fontWeight:800}}>✦ Import from recipe text · Free</button>{showTextImporter&&<div style={{background:"#fff",padding:14,borderRadius:14,marginTop:9,border:"1px solid #E8E0D7"}}><p style={{fontSize:12,color:C.inkSoft}}>Copy a TikTok caption or recipe text. Use headings “Ingredients” and “Steps”, with one item per line. No AI or paid service is used.</p><textarea value={recipeTextPaste} onChange={e=>setRecipeTextPaste(e.target.value)} rows={8} placeholder={"Mapo tofu\\nIngredients\\n400 g tofu\\n200 g minced chicken\\n2 tbsp soy sauce\\nSteps\\n1. Cut tofu into cubes\\n2. Cook minced chicken"} style={{...fieldStyle,resize:"vertical"}}/><button onClick={importRecipeText} disabled={!recipeTextPaste.trim()} style={{background:"#E9A28F",borderRadius:10,padding:"11px 14px",fontWeight:800,marginTop:8,opacity:recipeTextPaste.trim()?1:.5}}>Preview extracted recipe</button></div>}</div>}
      {!draft && (
        <button
          onClick={() => setDraft(blankDraft())}
          style={{
            width: "100%", background: "#FFF5EE", border: "1.5px dashed #CB9D8C", borderRadius: 16, padding: "15px 0",
            color: C.jade900, fontFamily: FONT_BODY, fontWeight: 700, fontSize: 13.5, marginBottom: 18,
          }}
        >
          ＋ Add a recipe
        </button>
      )}

      {error && <p style={{ fontSize: 11.5, color: C.clayText, marginBottom: 12 }}>{error}</p>}

      {draft && <button onClick={handleCancelDraft} style={{border:"1px solid #E9E3DF",borderRadius:12,padding:"10px 14px",marginBottom:12,background:"#fff",fontWeight:700}}>← Back to saved recipes</button>}
      {draft && (
        <div style={{ background: "#fff", border: "1px solid #E9E3DF", borderRadius: 22, padding: 18, marginBottom: 20,boxShadow:"0 5px 18px rgba(47,42,51,.04)" }}>
          {libraryEdit && (
            <div style={{ background: "#FBEFD5", border: `1px solid ${C.mustard}`, borderRadius: 9, padding: "8px 10px", marginBottom: 12, fontSize: 12, color: C.jade900, lineHeight: 1.45 }}>
              <b>Publishing to the shared library.</b> Everyone will see this recipe. Write it in your own words and credit the creator below.
            </div>
          )}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <span style={{ fontFamily: FONT_MONO, fontSize: 11, fontWeight: 700, color: C.jade700, textTransform: "uppercase", letterSpacing: 0.5 }}>
              {draft.id ? "Editing this recipe" : "New recipe"}
            </span>
            <button onClick={handleCancelDraft} style={{ fontSize: 11.5, color: C.inkSoft, fontWeight: 600 }}>Cancel</button>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
            {draft.photo ? (
              <img src={draft.photo} alt="" style={{ width: 64, height: 64, borderRadius: 10, objectFit: "cover", border: `1px solid ${C.line}`, flexShrink: 0 }} />
            ) : (
              <div style={{
                width: 64, height: 64, borderRadius: 10, border: `1.5px dashed ${C.line}`, flexShrink: 0,
                display: "flex", alignItems: "center", justifyContent: "center", color: C.inkSoft, background: C.paperDim,
              }}>
                <ChefHat size={20} />
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <input
                type="file"
                accept="image/*"
                id="recipe-photo-input"
                style={{ display: "none" }}
                onChange={e => handleDraftPhotoSelected(e.target.files && e.target.files[0])}
              />
              <label
                htmlFor="recipe-photo-input"
                style={{
                  display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, cursor: "pointer",
                  background: "#fff", color: C.jade700, border: `1.5px solid ${C.jade700}`, borderRadius: 9,
                  padding: "7px 12px", fontFamily: FONT_BODY, fontWeight: 700, fontSize: 12,
                }}
              >
                <BookmarkPlus size={13} /> {draft.photo ? "Change photo" : "Add a photo"}
              </label>
              {draft.photo && (
                <button onClick={removeDraftPhoto} style={{ fontSize: 11, color: C.clayText, fontWeight: 600, textAlign: "left" }}>
                  Remove photo
                </button>
              )}
            </div>
          </div>

          {!libraryEdit && <p style={{background:"#F1EFFB",borderRadius:12,padding:12,fontSize:12,color:C.ink}}>🔒 Just for you · Saving here never publishes your recipe.</p>}
          <label style={labelStyle}>What’s the dish called?</label>
          <input
            value={draft.name}
            onChange={e => setDraft(prev => ({ ...prev, name: e.target.value }))}
            style={fieldStyle}
          />

          <label style={{ ...labelStyle, marginTop: 4 }}>What goes into it? ({draft.baseServings} servings)</label>
          <p style={{fontSize:12,color:C.inkSoft,margin:"0 0 8px"}}>Paste ingredients, one per line. Review quantities before saving.</p>
          <textarea value={ingredientPaste} onChange={e=>setIngredientPaste(e.target.value)} rows={3} placeholder={"500g chicken\n2 tbsp soy sauce\n3 cloves garlic"} style={{...fieldStyle,resize:"vertical"}} />
          <button onClick={addPastedIngredients} disabled={!ingredientPaste.trim()} style={{border:0,borderRadius:10,background:"#F1EFFB",padding:"10px 14px",marginBottom:12,fontWeight:700,color:C.ink,opacity:ingredientPaste.trim()?1:.5}}>Add pasted ingredients</button>
          <p style={{fontSize:11,color:C.inkSoft,margin:"0 0 8px"}}>Or add and edit ingredients individually:</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 8 }}>
            {draft.ingredients.map(item => (
              <div key={item.id} style={{ border: `1px solid ${item.componentId ? C.jade600 : C.line}`, borderRadius: 9, padding: 8, background: item.componentId ? "#F2F6EE" : "transparent" }}>
                {componentRecipes.length > 0 && (
                  <select
                    value={item.componentId || ""}
                    onChange={e => linkIngredientToComponent(item.id, e.target.value || null)}
                    style={{ width: "100%", border: `1px solid ${C.line}`, borderRadius: 8, padding: "7px 6px", fontFamily: FONT_BODY, fontSize: 11.5, background: "#fff", color: C.inkSoft, marginBottom: 6 }}
                  >
                    <option value="">Plain ingredient (bought)</option>
                    {componentRecipes.map(r => (
                      <option key={r.id} value={r.id}>🔗 {r.name} (made from scratch)</option>
                    ))}
                  </select>
                )}
                {item.componentId ? (
                  <div style={{ fontSize: 12.5, color: C.jade700, fontWeight: 600, marginBottom: 6, display: "flex", alignItems: "center", gap: 5 }}>
                    <Link2 size={13} /> {item.name}
                  </div>
                ) : (
                  <input
                    value={item.name}
                    onChange={e => updateDraftIngredient(item.id, "name", e.target.value)}
                    placeholder="Ingredient name"
                    style={{ ...fieldStyle, marginBottom: 6 }}
                  />
                )}
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <input
                    type="number"
                    value={item.amount ?? ""}
                    onChange={e => updateDraftIngredient(item.id, "amount", e.target.value)}
                    placeholder="Qty"
                    style={{ width: 56, border: `1px solid ${C.line}`, borderRadius: 8, padding: "8px 6px", fontFamily: FONT_MONO, fontSize: 12, background: "#fff", color: C.ink }}
                  />
                  <input
                    value={item.unit}
                    onChange={e => updateDraftIngredient(item.id, "unit", e.target.value)}
                    placeholder="unit"
                    style={{ width: 56, border: `1px solid ${C.line}`, borderRadius: 8, padding: "8px 6px", fontFamily: FONT_MONO, fontSize: 12, background: "#fff", color: C.ink }}
                  />
                  {!item.componentId && (
                    <select
                      value={item.category}
                      onChange={e => updateDraftIngredient(item.id, "category", e.target.value)}
                      style={{ flex: 1, border: `1px solid ${C.line}`, borderRadius: 8, padding: "8px 4px", fontFamily: FONT_BODY, fontSize: 11, background: "#fff", color: C.inkSoft }}
                    >
                      {CATEGORY_ORDER.map(c => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
                    </select>
                  )}
                  <button onClick={() => removeDraftIngredient(item.id)} style={{ color: C.inkSoft, flexShrink: 0, marginLeft: item.componentId ? "auto" : 0 }}><X size={14} /></button>
                </div>
                {item.componentId && (
                  <p style={{ fontSize: 10, color: C.inkSoft, marginTop: 6, marginBottom: 0, lineHeight: 1.4 }}>
                    Enter how much of the finished {item.name.toLowerCase()} this recipe uses — if you're running low, it'll show up as a Weekend Prep batch to make first.
                  </p>
                )}
              </div>
            ))}
          </div>
          <button onClick={addDraftIngredient} style={{ display: "flex", alignItems: "center", gap: 5, color: C.jade700, fontSize: 12, fontWeight: 600, marginBottom: 14 }}>
            <Plus size={13} /> Add ingredient
          </button>

          {draft.isComponent ? (
            <div style={{ background: C.paperDim, borderRadius: 10, padding: "10px 12px", marginBottom: 14 }}>
              <label style={labelStyle}>One batch of this makes…</label>
              <div style={{ display: "flex", gap: 6, marginBottom: 4 }}>
                <input
                  type="number"
                  value={draft.yieldAmount}
                  onChange={e => setDraft(prev => ({ ...prev, yieldAmount: e.target.value }))}
                  placeholder="e.g. 200"
                  style={{ width: 90, border: `1px solid ${C.line}`, borderRadius: 8, padding: "8px 6px", fontFamily: FONT_MONO, fontSize: 12, background: "#fff", color: C.ink }}
                />
                <input
                  value={draft.yieldUnit}
                  onChange={e => setDraft(prev => ({ ...prev, yieldUnit: e.target.value }))}
                  placeholder="unit, e.g. g, cups"
                  style={{ flex: 1, border: `1px solid ${C.line}`, borderRadius: 8, padding: "8px 6px", fontFamily: FONT_MONO, fontSize: 12, background: "#fff", color: C.ink }}
                />
              </div>
              <p style={{ fontSize: 10.5, color: C.inkSoft, margin: 0, lineHeight: 1.4 }}>
                This is how much one round of making it gives you — used to work out how many batches to make for the week, and how much to add to your Kitchen stock once it's done.
              </p>
            </div>
          ) : null}

          <label style={labelStyle}>How do you cook it?</label>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 8 }}>
            {draft.steps.map((s, i) => (
              <div key={i} style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>
                <span style={{ fontFamily: FONT_MONO, fontSize: 11.5, color: C.inkSoft, marginTop: 9, width: 16, flexShrink: 0 }}>{i + 1}.</span>
                <textarea
                  value={s}
                  onChange={e => updateDraftStep(i, e.target.value)}
                  placeholder="What to do in this step…"
                  rows={2}
                  style={{ ...fieldStyle, marginBottom: 0, flex: 1, resize: "vertical" }}
                />
                <button onClick={() => removeDraftStep(i)} style={{ color: C.inkSoft, flexShrink: 0, marginTop: 8 }}><X size={14} /></button>
              </div>
            ))}
          </div>
          <button onClick={addDraftStep} style={{ display: "flex", alignItems: "center", gap: 5, color: C.jade700, fontSize: 12, fontWeight: 600, marginBottom: 14 }}>
            <Plus size={13} /> Add step
          </button>

          <details style={{border:"1px solid #E5E3EE",borderRadius:14,padding:"12px 14px",marginBottom:16,background:"#F7F7FB"}}>
            <summary style={{fontWeight:700,cursor:"pointer",color:C.ink}}>⚙ More details (optional) · Cuisine, protein, time and tags</summary>
            <div style={{paddingTop:14}}>
          <label style={labelStyle}>Cuisine</label>
          <input
            value={draft.cuisine}
            onChange={e => setDraft(prev => ({ ...prev, cuisine: e.target.value }))}
            placeholder="e.g. Mediterranean, Vietnamese…"
            list="cuisine-suggestions"
            style={fieldStyle}
          />
          <datalist id="cuisine-suggestions">
            {cuisineSuggestions.map(c => <option key={c} value={c} />)}
          </datalist>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10, marginTop: -4 }}>
            {CUISINES.map(c => (
              <Chip key={c} active={draft.cuisine === c} onClick={() => setDraft(prev => ({ ...prev, cuisine: c }))}>{c}</Chip>
            ))}
          </div>

          <label style={labelStyle}>Protein</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
            {PROTEINS.map(p => (
              <Chip key={p} active={draft.protein === p} onClick={() => setDraft(prev => ({ ...prev, protein: p }))}>{p}</Chip>
            ))}
          </div>


          <TimeInput minutes={draft.time} onChange={v => setDraft(prev => ({ ...prev, time: v }))} />
          {!draft.isComponent && (
            <Stepper label="This recipe serves (as shown)" value={draft.baseServings} min={1} max={20} onChange={v => setDraft(prev => ({ ...prev, baseServings: v }))} />
          )}

          {!draft.isComponent && (
            <>
              <Chip active={draft.soft} onClick={() => setDraft(prev => ({ ...prev, soft: !prev.soft }))}>
                Soft & easy to chew
              </Chip>
              <div style={{ marginBottom: 12 }} />

              <label style={labelStyle}>Good for</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
                {["breakfast", "lunch", "dinner"].map(t => (
                  <Chip key={t} active={draft.mealTypes.includes(t)} onClick={() => toggleDraftMealType(t)}>{capitalize(t)}</Chip>
                ))}
              </div>
            </>
          )}

          <label style={labelStyle}>Dish type</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 4 }}>
            <Chip active={!draft.side && !draft.isComponent} onClick={() => setDraft(prev => ({ ...prev, side: false, isComponent: false }))}>Main dish</Chip>
            <Chip active={!!draft.side && !draft.isComponent} onClick={() => setDraft(prev => ({ ...prev, side: true, isComponent: false }))}>Side dish</Chip>
            <Chip active={!!draft.isComponent} onClick={() => setDraft(prev => ({ ...prev, isComponent: true, side: false }))}>Condiment / base</Chip>
          </div>
          <p style={{ fontSize: 10.5, color: C.inkSoft, marginTop: 0, marginBottom: 12, lineHeight: 1.4 }}>
            {draft.isComponent
              ? "A condiment or base (sambal, curry roux, a spice paste…) is never planned as a meal on its own — it only shows up as a Weekend Prep batch to make, then gets added to your Kitchen stock so other recipes can use it."
              : "A side dish (e.g. a simple stir-fried vegetable, or a small meat bite with no veg) can get paired alongside someone else's main automatically when that main is missing meat or vegetable. A main dish never gets used that way, even if it happens to be missing one."}
          </p>

          <label style={labelStyle}>Source (optional — cookbook name, page, link, whatever helps you remember)</label>
          <input
            value={draft.sourceNote}
            onChange={e => setDraft(prev => ({ ...prev, sourceNote: e.target.value }))}
            placeholder="e.g. Mum's recipe book, pg 42"
            style={{ ...fieldStyle, marginBottom: 12 }}
          />

          <label style={labelStyle}>Credit the creator (optional — shown on the recipe with a link back)</label>
          <input value={draft.creatorName || ""} onChange={e => setDraft(prev => ({ ...prev, creatorName: e.target.value }))}
            placeholder="Creator name, e.g. Aunty Lim's Kitchen" style={{ ...fieldStyle, marginBottom: 8 }} />
          <input value={draft.creatorUrl || ""} onChange={e => setDraft(prev => ({ ...prev, creatorUrl: e.target.value }))}
            placeholder="Their channel or page link" inputMode="url" style={{ ...fieldStyle, marginBottom: 8 }} />
          <input value={draft.videoUrl || ""} onChange={e => setDraft(prev => ({ ...prev, videoUrl: e.target.value }))}
            placeholder="Link to the original video" inputMode="url" style={{ ...fieldStyle, marginBottom: 12 }} />

            </div>
          </details>
          {error && <p style={{ fontSize: 11.5, color: C.clayText, marginBottom: 8 }}>{error}</p>}

          <button
            onClick={handleSave}
            style={{
              width: "100%", background: C.jade700, color: "#fff", border: "none", borderRadius: 10,
              padding: "11px 0", fontFamily: FONT_BODY, fontWeight: 700, fontSize: 13,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
            }}
          >
            <BookmarkPlus size={15} /> {libraryEdit ? "Publish to the library" : draft.id ? "Save changes" : "Save to my recipes"}
          </button>
        </div>
      )}

      {!draft && !libraryEdit && <p style={{background:"#F1EFFB",borderRadius:12,padding:"12px 14px",fontSize:12.5,color:C.inkSoft}}>🔒 Private collection · Only you can see these recipes. They are never published automatically.</p>}
      {!draft && !libraryEdit && <SectionLabel>My private recipes ({myRecipes.length})</SectionLabel>}
      {!draft && (myRecipes.length === 0 ? (
        <p style={{ fontSize: 12.5, color: C.inkSoft }}>Nothing saved yet — recipes you import will show up here, and get mixed into future generated plans.</p>
      ) : (
        <>
          {myRecipes.length > 5 && (
            <div style={{ marginBottom: 12 }}>
              <input
                value={recipeQuery}
                onChange={e => setRecipeQuery(e.target.value)}
                placeholder="Search your recipes by name…"
                style={{ ...fieldStyle, marginBottom: 8 }}
              />
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: savedCuisines.length || savedProteins.length ? 8 : 0 }}>
                {["all", "main", "side", "component"].map(t => (
                  <Chip key={t} active={recipeFilterType === t} onClick={() => setRecipeFilterType(t)}>
                    {t === "all" ? "All" : t === "main" ? "Main" : t === "side" ? "Side" : "Condiment"}
                  </Chip>
                ))}
              </div>
              {savedCuisines.length > 1 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                  <Chip active={!recipeFilterCuisine} onClick={() => setRecipeFilterCuisine(null)}>All cuisines</Chip>
                  {savedCuisines.map(c => (
                    <Chip key={c} active={recipeFilterCuisine === c} onClick={() => setRecipeFilterCuisine(c === recipeFilterCuisine ? null : c)}>{c}</Chip>
                  ))}
                </div>
              )}
              {savedProteins.length > 1 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  <Chip active={!recipeFilterProtein} onClick={() => setRecipeFilterProtein(null)}>All proteins</Chip>
                  {savedProteins.map(p => (
                    <Chip key={p} active={recipeFilterProtein === p} onClick={() => setRecipeFilterProtein(p === recipeFilterProtein ? null : p)}>{p}</Chip>
                  ))}
                </div>
              )}
            </div>
          )}
          {filteredRecipes.length === 0 ? (
            <p style={{ fontSize: 12.5, color: C.inkSoft, fontStyle: "italic" }}>Nothing matches those filters.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {filteredRecipes.map(r => (
                <SavedRecipeCard key={r.id} recipe={r} onDelete={() => deleteRecipe(r.id)} onEdit={() => handleEditRecipe(r)} defaultPax={householdPax || r.baseServings || 1} />
              ))}
            </div>
          )}
        </>
      ))}
    </div>
  );
}

function SavedRecipeCard({ recipe, onDelete, onEdit, defaultPax }) {
  const [pax, setPax] = useState(defaultPax);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);

  return (
    <div style={{ background: "#fff", border: "1px solid #E9E3DF", borderRadius: 22, padding: "18px 16px", boxShadow:"0 5px 18px rgba(47,42,51,.04)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div style={{ display: "flex", gap: 10, minWidth: 0 }}>
          {recipe.photo && (
            <img
              src={recipe.photo}
              alt=""
              style={{ width: 72, height: 72, borderRadius: 16, objectFit: "cover", flexShrink: 0, border: `1px solid ${C.line}` }}
            />
          )}
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 20, color: C.ink, lineHeight:1.25 }}>{recipe.name}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 3, flexWrap: "wrap" }}>
              <Tag text={recipe.cuisine} />
              <Tag text={recipe.protein} />
              {recipe.isComponent && <Tag text="Condiment/base" />}
              {recipe.side && !recipe.isComponent && <Tag text="Side dish" />}
              {recipe.sourceNote && (
                <span style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 11, color: C.inkSoft, fontFamily: FONT_MONO }}>
                  <BookmarkPlus size={11} /> {recipe.sourceNote}
                </span>
              )}
            </div>
            <CreditLine r={recipe} />
          </div>
        </div>
        <div style={{flexShrink:0,position:"relative"}}><button aria-label="Recipe options" aria-expanded={actionsOpen} onClick={()=>setActionsOpen(v=>!v)} style={{border:"1px solid #E9E3DF",background:"#FAF7F2",borderRadius:12,padding:"8px 12px",fontWeight:800,color:C.ink}}>•••</button>{actionsOpen && <div style={{display:"grid",gap:6,marginTop:6}}><button onClick={()=>{setActionsOpen(false);onEdit();}} style={{padding:8,borderRadius:10,background:"#F1EFFB",color:C.ink}}>Edit</button><button onClick={()=>{setActionsOpen(false);onDelete();}} style={{padding:8,borderRadius:10,background:"#FBE9E3",color:C.clayText}}>Delete</button></div>}</div>
      </div>

      <button onClick={()=>setDetailsOpen(v=>!v)} aria-expanded={detailsOpen} style={{width:"100%",marginTop:14,display:"flex",justifyContent:"space-between",alignItems:"center",background:"#FAF7F2",border:"1px solid #E9E3DF",borderRadius:13,padding:"12px 14px",fontSize:14,fontWeight:750,color:C.ink}}><span>{detailsOpen?"Hide recipe":"View ingredients & cooking steps"}</span><ChevronDown size={17} style={{transform:detailsOpen?"rotate(180deg)":"none",transition:"transform .2s"}} /></button>
      {detailsOpen && <div style={{paddingTop:12}}>{recipe.baseServings ? (
        <div style={{ marginTop: 10 }}>
          <Stepper label="Servings" value={pax} min={1} max={20} onChange={setPax} />
        </div>
      ) : null}

      <div style={{ marginTop: 6, fontSize: 11.5, color: C.inkSoft, fontFamily: FONT_MONO, lineHeight: 1.7 }}>
        {recipe.ingredients.map((i, idx) => (
          <div key={idx}>
            {i.amount != null
              ? `${formatQty(scaledAmount(i.amount, recipe.baseServings, pax))} ${i.unit} ${i.name}`
              : i.name}
          </div>
        ))}
      </div>

      {recipe.steps?.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontFamily: FONT_MONO, fontSize: 12.5, fontWeight: 700, color: C.jade700, display: "flex", alignItems: "center", gap: 6 }}>
            <ChefHat size={14} /> How to cook ({recipe.steps.length} steps)
          </div>
          <StepsList steps={recipe.steps} />
        </div>
      )}</div>}
    </div>
  );
}


// Only ever link to normal web addresses (never javascript: and the like).
function safeUrl(u) {
  let t = String(u || "").trim();
  if (!t) return "";
  if (!/^https?:\/\//i.test(t)) t = "https://" + t;
  try { const x = new URL(t); return x.protocol === "https:" || x.protocol === "http:" ? x.href : ""; } catch (e) { return ""; }
}

// "Recipe by …" + a link to the original video, shown wherever a recipe appears.
function CreditLine({ r }) {
  const name = (r.creatorName || "").trim();
  const creatorUrl = safeUrl(r.creatorUrl);
  const videoUrl = safeUrl(r.videoUrl);
  if (!name && !videoUrl) return null;
  const a = { color: C.jade700, fontWeight: 600, textDecoration: "underline" };
  return (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "4px 12px", fontSize: 11.5, color: C.inkSoft, fontFamily: FONT_BODY, marginTop: 4 }}>
      {name && (
        <span>Recipe by {creatorUrl
          ? <a href={creatorUrl} target="_blank" rel="noopener noreferrer nofollow" style={a}>{name}</a>
          : <b style={{ color: C.ink }}>{name}</b>}</span>
      )}
      {videoUrl && (
        <a href={videoUrl} target="_blank" rel="noopener noreferrer nofollow" style={{ ...a, display: "inline-flex", alignItems: "center", gap: 4 }}>
          <Play size={11} /> Watch the original video
        </a>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------
   LIBRARY — recipes shared with everyone. Only the admin account can
   add, edit or remove them; everyone else can browse and copy a recipe
   into their own list ("Add to my recipes"), credit included.
------------------------------------------------------------------*/
function LibraryScreen({ library, isAdmin, configured, myRecipes, onAdd, onRefresh, onDelete, onNew, onEdit }) {
  const [q, setQ] = useState("");
  const [cuisine, setCuisine] = useState(null);
  const [open, setOpen] = useState(null);
  const [confirmDel, setConfirmDel] = useState(null);
  const [photoSaving, setPhotoSaving] = useState(null);
  const [photoMessage, setPhotoMessage] = useState("");
  const photoRecords = (library.items || []).filter(r => r.kind === "builtin-photo");
  const communityItems = (library.items || []).filter(r => r.kind !== "builtin-photo");
  const items = [...MEALS.map(r => ({...r, id: `builtin-${r.id}`, builtIn: true, photo: photoRecords.find(p=>p.mealId===r.id)?.photo || r.photo})), ...communityItems];
  async function publishPhoto(mealId,file) {
    if (!file) return;
    setPhotoSaving(mealId);setPhotoMessage("");
    try {
      const photo = await new Promise((resolve,reject)=>{
        const reader = new FileReader();reader.onerror=()=>reject(new Error("Could not read image"));
        reader.onload=()=>{const img=new Image();img.onerror=()=>reject(new Error("Could not open image"));
          img.onload=()=>{const canvas=document.createElement("canvas");const scale=Math.min(1,480/img.width);canvas.width=Math.max(1,Math.round(img.width*scale));canvas.height=Math.max(1,Math.round(img.height*scale));canvas.getContext("2d").drawImage(img,0,0,canvas.width,canvas.height);resolve(canvas.toDataURL("image/jpeg",.65))};img.src=reader.result};reader.readAsDataURL(file);
      });
      await saveBuiltinRecipePhoto(mealId,photo);
      await onRefresh();
      setPhotoMessage("Official photo published. Everyone can now see it.");
    } catch(e) {setPhotoMessage(e?.message || "Could not publish the photo.");}
    finally {setPhotoSaving(null);}
  }
  const cuisines = useMemo(() => [...new Set(items.map(r => r.cuisine).filter(Boolean))].sort(), [items]);
  const shown = useMemo(() => items.filter(r =>
    (!q.trim() || r.name.toLowerCase().includes(q.trim().toLowerCase())) && (!cuisine || r.cuisine === cuisine)), [items, q, cuisine]);
  const added = (id) => myRecipes.some(r => r.libraryId === id);

  return (
    <div style={{ padding: "24px 18px 36px",background:"#FAF7F2",minHeight:"70vh" }}>
      <div style={{background:"linear-gradient(125deg,#354E60,#6A8A94)",color:"#fff",borderRadius:24,padding:"25px 22px",marginBottom:20,position:"relative",overflow:"hidden"}}><div style={{position:"absolute",right:-12,top:-12,fontSize:106,opacity:.17,pointerEvents:"none"}}>🍲</div><div style={{fontSize:11,fontWeight:800,letterSpacing:2,color:"#DDEFF3",marginBottom:9}}>{isAdmin ? "CURATE THE COLLECTION" : "A WORLD OF GOOD FOOD"}</div><h2 style={{fontFamily:FONT_DISPLAY,fontSize:33,lineHeight:1.1,margin:"0 0 11px",maxWidth:250}}>{isAdmin ? "Your recipe studio." : "Find your next favourite."}</h2><div style={{fontSize:13,color:"#EDF6F7"}}>{items.length ? `${items.length} recipes to explore` : "A shared cookbook, growing together"}</div></div>

      {!isAdmin && <p style={{fontSize:12,color:C.inkSoft,margin:"-7px 0 16px"}}>Explore recipes already available in your meal planner. Community additions appear here too.</p>}
      {isAdmin && photoMessage && <p role="status" style={{padding:"11px 13px",background:"#fff",borderRadius:10,color:"#365C4B",fontSize:12}}>{photoMessage}</p>}
      {isAdmin && (
        <button onClick={onNew} style={{ width: "100%", background: "#E9A28F", border: "none", borderRadius: 16, padding: "15px 0", color: C.jade900, fontFamily: FONT_BODY, fontWeight: 700, fontSize: 13, marginBottom: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          <Plus size={15} /> New library recipe <span style={{ fontWeight: 500, fontSize: 11 }}>(admin)</span>
        </button>
      )}

      {isAdmin && !configured ? (
        <p style={{ fontSize: 12.5, color: C.inkSoft }}>The shared library needs the online version of the site.</p>
      ) : isAdmin && (library.status === "loading" || library.status === "idle") ? (
        <p style={{ fontSize: 12.5, color: C.inkSoft }}>Loading recipes…</p>
      ) : isAdmin && library.status === "error" ? (
        <div>
          <p style={{ fontSize: 12.5, color: C.clayText }}>{library.error}</p>
          <button onClick={onRefresh} style={{ fontSize: 12, fontWeight: 700, color: C.jade700, textDecoration: "underline" }}>Try again</button>
        </div>
      ) : items.length === 0 ? (
        <div style={{textAlign:"center",padding:"48px 22px",background:"#fff",border:"1px solid #E9E3DF",borderRadius:22}}><div style={{fontSize:42,marginBottom:10}}>📖</div><h3 style={{fontFamily:FONT_DISPLAY,fontSize:23,margin:"0 0 8px"}}>A cookbook in the making</h3><p style={{fontSize:13,color:C.inkSoft,lineHeight:1.6,margin:0}}>{isAdmin ? "Start your community collection with the first recipe above." : "Shared recipes will appear here as the collection grows."}</p></div>
      ) : (
        <>
          {items.length > 0 && (
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search the library…" style={{ ...fieldStyle, marginBottom: 8 }} />
          )}
          {cuisines.length > 1 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
              <Chip active={!cuisine} onClick={() => setCuisine(null)}>All</Chip>
              {cuisines.map(c => <Chip key={c} active={cuisine === c} onClick={() => setCuisine(c === cuisine ? null : c)}>{c}</Chip>)}
            </div>
          )}
          {shown.length === 0 && <p style={{ fontSize: 12.5, color: C.inkSoft }}>Nothing matches that.</p>}
          <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:14,alignItems:"start"}}>
            {shown.map(r => (
              <article key={r.id} style={{background:"#fff",borderRadius:17,overflow:"hidden",boxShadow:"0 5px 15px rgba(49,38,30,.09)",minWidth:0}}>
                <button onClick={()=>setOpen(open===r.id?null:r.id)} aria-label={`View ${r.name} recipe`} style={{display:"block",width:"100%",textAlign:"left",padding:0,background:"transparent",border:0,color:C.ink}}>
                  <div style={{aspectRatio:"1.18",background:"linear-gradient(135deg,#F0DDC5,#D8E4D2)",display:"grid",placeItems:"center",position:"relative",overflow:"hidden"}}>
                    {r.photo ? <img src={r.photo} alt={r.name} loading="lazy" style={{width:"100%",height:"100%",objectFit:"cover",position:"absolute",inset:0}}/> : <span aria-hidden="true" style={{fontSize:56,filter:"drop-shadow(0 5px 6px rgba(0,0,0,.08))"}}>{r.protein==="fish"||r.protein==="seafood"?"🐟":r.protein==="chicken"?"🍗":r.side?"🥬":"🍲"}</span>}
                    <span style={{position:"absolute",bottom:9,left:9,background:"rgba(255,255,255,.92)",borderRadius:999,padding:"4px 8px",fontSize:10,fontWeight:800,color:"#4D6558"}}>{r.cuisine||"Recipe"}</span>
                  </div>
                  <div style={{padding:"13px 12px 8px",minHeight:114,display:"flex",flexDirection:"column",justifyContent:"space-between",gap:12}}>
                    <div style={{fontSize:16,fontWeight:800,lineHeight:1.32,fontFamily:FONT_BODY}}>{r.name}</div>
                    <div style={{display:"flex",alignItems:"center",gap:5,color:"#8B776C",fontSize:12}}><Clock size={14} color="#D07D58"/>{formatDuration(r.time)}</div>
                  </div>
                </button>
                <div style={{padding:"0 12px 12px"}}>
                  {isAdmin && r.builtIn && <label style={{display:"block",textAlign:"center",padding:"9px 4px",fontSize:11,fontWeight:800,color:"#365C4B",cursor:photoSaving===r.id.slice(8)?"wait":"pointer"}}>📷 {photoSaving===r.id.slice(8)?"Publishing…":r.photo?"Replace official photo":"Upload official photo"}<input type="file" accept="image/*" disabled={!!photoSaving} style={{display:"none"}} onChange={e=>{publishPhoto(r.id.slice(8),e.target.files?.[0]);e.target.value=""}}/></label>}
                  <button onClick={()=>!r.builtIn&&!added(r.id)&&onAdd(r)} disabled={r.builtIn||added(r.id)} style={{width:"100%",padding:"9px 5px",borderRadius:10,background:r.builtIn||added(r.id)?"#EDF1EA":"#365C4B",color:r.builtIn||added(r.id)?"#45624F":"#fff",fontSize:11,fontWeight:800}}>{r.builtIn?"In meal planner":added(r.id)?"✓ Saved":"＋ Save recipe"}</button>
                  {isAdmin&&!r.builtIn&&<div style={{display:"flex",justifyContent:"space-between",marginTop:8}}><button onClick={()=>onEdit(r)} style={{fontSize:11,fontWeight:800,color:"#365C4B"}}>✎ Edit recipe & photo</button><button onClick={()=>{if(confirmDel===r.id){setConfirmDel(null);onDelete(r.id)}else setConfirmDel(r.id)}} style={{fontSize:11,color:C.clayText}}>{confirmDel===r.id?"Confirm remove":"Remove"}</button></div>}
                </div>
                {open===r.id&&<div style={{padding:"12px",borderTop:"1px solid #EDE8E1",fontSize:12,lineHeight:1.55}}>
                  <CreditLine r={r}/>
                  <div style={{fontWeight:800,margin:"8px 0 4px"}}>Ingredients · serves {r.baseServings||4}</div>
                  <ul style={{paddingLeft:18,margin:"0 0 10px"}}>{(r.ingredients||[]).map((i,k)=><li key={k}>{[i.amount,i.unit,i.name].filter(x=>x!==null&&x!==undefined&&x!=="").join(" ")}</li>)}</ul>
                  {!!r.steps?.length&&<><div style={{fontWeight:800,marginBottom:4}}>How to cook</div><ol style={{paddingLeft:18,margin:0}}>{r.steps.map((step,k)=><li key={k}>{step}</li>)}</ol></>}
                </div>}
              </article>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

const labelStyle = { fontSize: 11, fontWeight: 600, color: C.inkSoft, display: "block", marginBottom: 5 };
const fieldStyle = { width: "100%", padding: "8px 10px", borderRadius: 8, border: `1px solid ${C.line}`, fontFamily: FONT_BODY, fontSize: 13, background: "#fff", color: C.ink, marginBottom: 10 };

