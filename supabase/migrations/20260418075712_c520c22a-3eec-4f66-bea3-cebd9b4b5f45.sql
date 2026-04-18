-- Roles
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert roles"
  ON public.user_roles FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update roles"
  ON public.user_roles FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete roles"
  ON public.user_roles FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Pod images
CREATE TABLE public.pod_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pod_id UUID NOT NULL REFERENCES public.pods(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  alt TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pod_images_pod_id ON public.pod_images(pod_id, display_order);

ALTER TABLE public.pod_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Pod images are viewable by everyone"
  ON public.pod_images FOR SELECT
  USING (true);

CREATE POLICY "Admins can insert pod images"
  ON public.pod_images FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update pod images"
  ON public.pod_images FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete pod images"
  ON public.pod_images FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('pod-images', 'pod-images', true);

CREATE POLICY "Pod images are publicly accessible"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'pod-images');

CREATE POLICY "Admins can upload pod images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'pod-images' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update pod images files"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'pod-images' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete pod images files"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'pod-images' AND public.has_role(auth.uid(), 'admin'));