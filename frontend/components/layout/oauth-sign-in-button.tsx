"use client";

import Image from "next/image";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

type OAuthProvider = "google" | "linkedin_oidc";

type ProviderConfig = {
  label: string;
  iconSrc: string;
  iconSize: number;
};

const PROVIDER_CONFIG: Record<OAuthProvider, ProviderConfig> = {
  google: {
    label: "Google",
    iconSrc: "/google-icon.svg",
    iconSize: 30,
  },
  linkedin_oidc: {
    label: "LinkedIn",
    iconSrc: "/linkedin-icon.svg",
    iconSize: 30,
  },
};

type Props = {
  provider: OAuthProvider;
};

export function OAuthSignInButton({ provider }: Props) {
  const [loading, setLoading] = useState(false);
  const config = PROVIDER_CONFIG[provider];

  async function onClick() {
    setLoading(true);
    try {
      const supabase = createClient();
      const origin = window.location.origin;
      await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${origin}/auth/callback?next=/`,
        },
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      disabled={loading}
      aria-label={`Продовжити з ${config.label}`}
      title={`Продовжити з ${config.label}`}
      className="size-12 rounded-full border-slate-300 bg-white p-0 text-slate-700 shadow-sm hover:bg-slate-50 cursor-pointer"
      onClick={() => void onClick()}
    >
      {loading ? (
        <span className="text-lg leading-none">...</span>
      ) : (
        <Image src={config.iconSrc} alt="" width={config.iconSize} height={config.iconSize} />
      )}
    </Button>
  );
}
