import { useEffect, useState, type ImgHTMLAttributes } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * <img> that understands `storage://<bucket>/<path>` references (private KYC bucket).
 * Driver photos are stored that way since the driver_kyc bucket was made private; a plain
 * <img src="storage://…"> renders nothing. The signed URL is valid for one hour and only
 * issued if storage RLS lets the viewer read the file (owner, their passengers, admins).
 */
export function StorageImage({
  src,
  ...rest
}: ImgHTMLAttributes<HTMLImageElement> & { src?: string | null }) {
  const [resolved, setResolved] = useState<string | undefined>(
    src && !src.startsWith("storage://") ? src : undefined,
  );

  useEffect(() => {
    let cancelled = false;
    if (!src) {
      setResolved(undefined);
      return;
    }
    if (!src.startsWith("storage://")) {
      setResolved(src);
      return;
    }
    const rest = src.slice("storage://".length);
    const slash = rest.indexOf("/");
    if (slash <= 0) return;
    const bucket = rest.slice(0, slash);
    const path = rest.slice(slash + 1);
    void supabase.storage
      .from(bucket)
      .createSignedUrl(path, 3600)
      .then(({ data }) => {
        if (!cancelled) setResolved(data?.signedUrl);
      });
    return () => {
      cancelled = true;
    };
  }, [src]);

  if (!resolved) return null;
  return <img src={resolved} {...rest} />;
}
