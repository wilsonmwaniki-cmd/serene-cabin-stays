import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type SiteContent = { id: string; key: string; label: string | null; value: string };

export const useSiteContent = () =>
  useQuery({
    queryKey: ["site_content"],
    queryFn: async (): Promise<Record<string, string>> => {
      const { data, error } = await supabase.from("site_content").select("key,value");
      if (error) throw error;
      return Object.fromEntries((data ?? []).map((r) => [r.key, r.value]));
    },
  });

export const useSiteContentRows = () =>
  useQuery({
    queryKey: ["site_content_rows"],
    queryFn: async (): Promise<SiteContent[]> => {
      const { data, error } = await supabase
        .from("site_content")
        .select("id,key,label,value")
        .order("key");
      if (error) throw error;
      return data as SiteContent[];
    },
  });

export const useUpdateSiteContent = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, value }: { id: string; value: string }) => {
      const { error } = await supabase.from("site_content").update({ value }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["site_content"] });
      qc.invalidateQueries({ queryKey: ["site_content_rows"] });
    },
  });
};

export const sc = (map: Record<string, string> | undefined, key: string, fallback: string) =>
  map?.[key] ?? fallback;
