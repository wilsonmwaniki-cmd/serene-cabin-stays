import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type MessageStatus = "new" | "read" | "replied" | "archived";

export type AdminMessage = {
  id: string;
  created_at: string;
  name: string;
  email: string;
  phone: string | null;
  subject: string | null;
  message: string;
  status: MessageStatus;
};

export const useAdminMessages = () =>
  useQuery({
    queryKey: ["admin_messages"],
    queryFn: async (): Promise<AdminMessage[]> => {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as AdminMessage[];
    },
  });
