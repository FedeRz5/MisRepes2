import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import MainShell from "@/components/layout/MainShell";
import type { Profile } from "@/types/database";

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  let { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  // Si no existe el perfil, crearlo automaticamente
  if (!profile) {
    const { data: newProfile } = await supabase
      .from("profiles")
      .insert({
        id: user.id,
        email: user.email || "",
        full_name: user.user_metadata?.full_name || "",
        role: "user",
      })
      .select()
      .single();
    profile = newProfile;
  }

  if (!profile) {
    await supabase.auth.signOut();
    redirect("/login");
  }

  // Check if user is banned
  if (profile.banned) {
    await supabase.auth.signOut();
    redirect("/login?banned=1");
  }

  const typedProfile = profile as Profile;

  return <MainShell profile={typedProfile}>{children}</MainShell>;
}
