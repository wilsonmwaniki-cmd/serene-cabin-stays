import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type PodImage = {
  id: string;
  pod_id: string;
  storage_path: string;
  alt: string | null;
  display_order: number;
  url: string;
};

const BUCKET = "pod-images";

const toPublicUrl = (path: string) =>
  supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;

export const usePodImages = (podId?: string) =>
  useQuery({
    queryKey: ["pod_images", podId ?? "all"],
    queryFn: async (): Promise<PodImage[]> => {
      let q = supabase
        .from("pod_images")
        .select("*")
        .order("display_order", { ascending: true })
        .order("created_at", { ascending: true });
      if (podId) q = q.eq("pod_id", podId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []).map((r) => ({ ...r, url: toPublicUrl(r.storage_path) })) as PodImage[];
    },
  });

export const podImagesBucket = BUCKET;
