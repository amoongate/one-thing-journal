// Supabase client plus auth and data helpers for One Thing Journal.
// Env vars are set in Vercel: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.
import { createClient } from "@supabase/supabase-js";
import { DEFAULT_QUOTES, DEFAULT_CATS, DEFAULT_GOAL_CATS, DEFAULT_GOALS } from "./assets";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(url, key);

// ---- auth ----
export function getSession() {
  return supabase.auth.getSession().then((r) => r.data.session);
}
export function onAuth(cb) {
  return supabase.auth.onAuthStateChange((event, session) => cb(event, session));
}
export function signUpEmail(email, password, name) {
  return supabase.auth.signUp({ email, password, options: { data: { name } } });
}
export function signInEmail(email, password) {
  return supabase.auth.signInWithPassword({ email, password });
}
export function signInGoogle() {
  return supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: window.location.origin },
  });
}
export function signOut() {
  return supabase.auth.signOut();
}
export function sendReset(email) {
  return supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
}
export function updatePassword(password) {
  return supabase.auth.updateUser({ password });
}

// ---- data ----
// Profiles hold name, email, phone, rest_day, and the per-weekday quotes.
// Entries hold one row per user per date with the day's plan as JSONB.
export async function loadData(userId, fallbackEmail) {
  let { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (!profile) {
    // The signup trigger normally creates this. Create a default if missing.
    const def = {
      id: userId,
      email: fallbackEmail || "",
      name: "",
      title: "",
      phone: "",
      rest_day: null,
      quotes: DEFAULT_QUOTES,
      categories: DEFAULT_CATS,
      goal_categories: DEFAULT_GOAL_CATS,
      goals: DEFAULT_GOALS,
    };
    await supabase.from("profiles").upsert(def);
    profile = def;
  }

  const { data: rows } = await supabase
    .from("entries")
    .select("date,data")
    .eq("user_id", userId);

  const entries = {};
  (rows || []).forEach((r) => {
    entries[r.date] = r.data;
  });

  const restDay =
    profile.rest_day === null || profile.rest_day === undefined
      ? ""
      : String(profile.rest_day);

  return {
    user: {
      name: profile.name || "",
      title: profile.title || "",
      email: profile.email || fallbackEmail || "",
      phone: profile.phone || "",
      restDay,
    },
    quotes: profile.quotes && profile.quotes.length ? profile.quotes : DEFAULT_QUOTES,
    categories: profile.categories && profile.categories.length ? profile.categories : DEFAULT_CATS,
    goalCategories: profile.goal_categories && profile.goal_categories.length ? profile.goal_categories : DEFAULT_GOAL_CATS,
    goals: Array.isArray(profile.goals) ? profile.goals : DEFAULT_GOALS,
    entries,
  };
}

export function saveEntry(userId, date, data) {
  return supabase
    .from("entries")
    .upsert(
      { user_id: userId, date, data, updated_at: new Date().toISOString() },
      { onConflict: "user_id,date" }
    );
}

export function saveProfile(userId, user, quotes, categories, goalCategories, goals) {
  return supabase
    .from("profiles")
    .update({
      name: user.name,
      title: user.title,
      phone: user.phone,
      rest_day: user.restDay === "" ? null : user.restDay,
      quotes,
      categories,
      goal_categories: goalCategories,
      goals,
    })
    .eq("id", userId);
}

// ---- Goal-category plan PDFs (Supabase Storage: bucket "plans") ----
export async function uploadPlan(userId, catId, file) {
  const path = `${userId}/${catId}.pdf`;
  const { error } = await supabase.storage
    .from("plans")
    .upload(path, file, { upsert: true, contentType: "application/pdf" });
  if (error) throw error;
  return path;
}

export async function loadPlan(userId, catId) {
  const path = `${userId}/${catId}.pdf`;
  const { data, error } = await supabase.storage.from("plans").download(path);
  if (error) throw error;
  return data; // Blob
}

export async function removePlan(userId, catId) {
  const path = `${userId}/${catId}.pdf`;
  await supabase.storage.from("plans").remove([path]);
}
