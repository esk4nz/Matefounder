"use client";

import Image from "next/image";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

type Props = {
  label?: string;
};

export function GoogleSignInButton({ label = "Google" }: Props) {
  const [loading, setLoading] = useState(false);

  async function onClick() {
    setLoading(true);
    try {
      const supabase = createClient();
      const origin = window.location.origin;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${origin}/auth/callback?next=/`,
        },
      });
      if (error) {
        console.error(error.message);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      disabled={loading}
      className="w-full border-slate-300 bg-white text-slate-700 hover:bg-slate-50 flex gap-2 h-11 shadow-sm cursor-pointer"
      onClick={() => void onClick()}
    >
      <Image src="/google-icon.svg" alt="" width={18} height={18} />
      {loading ? "…" : label}
    </Button>
  );
}
