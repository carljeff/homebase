import {z} from "zod";
export const foodProfileSchema=z.object({
 version:z.literal(1).default(1),mostlyVegetarian:z.boolean().default(false),preferredProteins:z.array(z.string().max(80)).max(20).default([]),avoidBrands:z.array(z.string().max(80)).max(30).default([]),
 favoriteMealTerms:z.array(z.string().max(100)).max(80).default([]),occasionalMealTerms:z.array(z.string().max(100)).max(30).default([]),busyDays:z.array(z.number().int().min(0).max(6)).max(7).default([]),batchDays:z.array(z.number().int().min(0).max(6)).max(7).default([]),
 substantialMealsMin:z.number().int().min(1).max(7).default(3),substantialMealsMax:z.number().int().min(1).max(7).default(4),mealsOutPerWeek:z.number().int().min(0).max(7).default(1),quickMinutes:z.number().int().min(5).max(120).default(35),cooldownDays:z.number().int().min(1).max(90).default(14),occasionalCooldownDays:z.number().int().min(7).max(180).default(42),heartPriority:z.boolean().default(false),highSubstituteSatFatGrams:z.number().min(0).max(30).default(3),
 substitutions:z.array(z.object({match:z.enum(["ground_beef","chicken"]),enabled:z.boolean(),replacement:z.string().min(1).max(200),saturatedFatGramsPerServing:z.number().min(0).max(100).nullable().default(null)})).max(2).default([]),notes:z.string().max(12000).default("")
}).refine(p=>p.substantialMealsMin<=p.substantialMealsMax,{message:"Minimum dinners must not exceed maximum"}).refine(p=>new Set(p.substitutions.map(s=>s.match)).size===p.substitutions.length,{message:"One substitution rule per ingredient"});
export type FoodProfile=z.infer<typeof foodProfileSchema>;
export const genericFoodProfile=foodProfileSchema.parse({});
