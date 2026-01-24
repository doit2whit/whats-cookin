// User types
export interface User {
  email: string;
  name: string;
  role: 'admin' | 'user';
  createdAt: string;
}

// Meal types
export type MealType = 'homemade' | 'restaurant' | 'friends_house' | 'leftovers';
export type Chef = 'Ian' | 'Hanna' | 'Other';

export interface Meal {
  id: string;
  name: string;
  cuisineType: string[];
  chef: Chef;
  isLeftovers: boolean;
  isFavorite: boolean;
  isQuick: boolean;
  notes: string;
  leftoverNotes: string;
  ianRating: number | null;
  hannaRating: number | null;
  mealType: MealType;
  restaurantName: string;
  friendName: string;
  effort: number | null; // 1-5 scale
  createdAt: string;
  lastUsed: string | null;
  useCount: number;
}

export interface MealFormData {
  name: string;
  cuisineType: string[];
  chef: Chef;
  isLeftovers: boolean;
  isFavorite: boolean;
  isQuick: boolean;
  notes: string;
  leftoverNotes?: string;
  ianRating: number | null;
  hannaRating: number | null;
  mealType: MealType;
  restaurantName: string;
  friendName: string;
  effort: number | null;
  ingredients: IngredientEntry[];
}

// Ingredient types
export type Unit = 'cup' | 'cups' | 'lb' | 'lbs' | 'tbsp' | 'tsp' | 'ml' | 'g' | 'oz' | 'qt' | 'count' | 'cloves' | 'cans' | 'packages' | 'bunches' | 'heads' | 'slices' | '';
export type StoreSection = 'produce' | 'dairy' | 'meat' | 'pantry' | 'frozen' | 'bakery' | 'beverages' | 'other';

export interface Ingredient {
  id: string;
  name: string;
  displayName: string;
  storeSection: StoreSection;
  defaultUnit: Unit;
  isCommonItem: boolean; // spices/common items flag
  createdAt: string;
  lastUsed: string | null;
}

export interface IngredientEntry {
  ingredientId?: string;
  name: string;
  quantity: number | null;
  unit: Unit;
  storeSection: StoreSection;
  isCommonItem?: boolean;
  notes?: string;
}

export interface MealIngredient {
  id: string;
  mealId: string;
  ingredientId: string;
  quantity: number | null;
  unit: Unit;
  notes: string;
}

// Calendar types
export interface CalendarEntry {
  id: string;
  date: string; // YYYY-MM-DD
  mealId: string;
  slot: 1 | 2;
  isLeftoverEntry: boolean; // true if this was leftovers
  createdAt: string;
  createdBy: string;
  meal?: Meal; // Populated when fetching
}

// Shopping list types
export interface ShoppingList {
  id: string;
  name: string;
  mealIds: string[];
  createdAt: string;
  expiresAt: string;
  createdBy: string;
}

export interface ShoppingListItem {
  id: string;
  listId: string;
  ingredientId: string;
  combinedQuantity: string;
  storeSection: StoreSection;
  isChecked: boolean;
  displayOrder: number;
  ingredientName?: string;
  ingredient?: Ingredient; // Populated when fetching
}

// Cuisine tag
export interface CuisineTag {
  id: string;
  name: string;
  useCount: number;
}

// Meal history for expanded view
export interface MealHistoryEntry {
  date: string;
  chef: Chef;
  isLeftoverEntry: boolean;
}

// API response types
export interface ApiResponse<T> {
  data?: T;
  error?: string;
  code?: 'UNAUTHORIZED' | 'NOT_FOUND' | 'VALIDATION' | 'RATE_LIMIT' | 'SHEETS_ERROR';
}

// Calendar view types
export type CalendarView = 'month' | 'week';
