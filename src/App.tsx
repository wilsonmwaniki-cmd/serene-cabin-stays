import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SiteLayout } from "@/components/site/SiteLayout";
import { AdminLayout } from "@/components/admin/AdminLayout";
import Home from "./pages/Home";
import Stays from "./pages/Stays";
import Restaurant from "./pages/Restaurant";
import Contact from "./pages/Contact";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import Book from "./pages/Book";
import BookPod from "./pages/BookPod";
import Unsubscribe from "./pages/Unsubscribe";
import Admin from "./pages/Admin";
import AdminBookings from "./pages/admin/Bookings";
import AdminMessages from "./pages/admin/Messages";
import AdminPods from "./pages/admin/Pods";
import AdminAddons from "./pages/admin/Addons";
import AdminContent from "./pages/admin/Content";
import AdminGallery from "./pages/admin/Gallery";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route element={<SiteLayout />}>
            <Route path="/" element={<Home />} />
            <Route path="/stays" element={<Stays />} />
            <Route path="/restaurant" element={<Restaurant />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/book" element={<Book />} />
            <Route path="/book/:slug" element={<BookPod />} />
            <Route path="/unsubscribe" element={<Unsubscribe />} />
          </Route>
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<Admin />} />
            <Route path="bookings" element={<AdminBookings />} />
            <Route path="messages" element={<AdminMessages />} />
            <Route path="pods" element={<AdminPods />} />
            <Route path="addons" element={<AdminAddons />} />
            <Route path="content" element={<AdminContent />} />
            <Route path="gallery" element={<AdminGallery />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
