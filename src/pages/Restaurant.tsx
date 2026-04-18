import restaurantImg from "@/assets/restaurant.jpg";
import { Link } from "react-router-dom";

const Restaurant = () => {
  return (
    <section className="relative min-h-[100vh] flex items-center justify-center">
      <img
        src={restaurantImg}
        alt="Candlelit dinner table at Wild By LERA at sunset"
        className="absolute inset-0 w-full h-full object-cover"
        width={1600}
        height={1200}
      />
      <div className="absolute inset-0 bg-ink/70" />
      <div className="relative container text-center flex flex-col items-center">
        <p className="text-bone/80 text-xs uppercase tracking-[0.4em] mb-6">The Restaurant</p>
        <h1 className="font-display text-bone text-5xl md:text-7xl lg:text-[88px] leading-[0.95] max-w-4xl text-balance">
          Coming soon.
        </h1>
        <p className="mt-8 text-bone/85 text-lg md:text-xl max-w-xl font-extralight font-serif">
          Our restaurant is currently under construction. Tables under the acacia will be set soon.
        </p>
        <Link
          to="/"
          className="mt-12 inline-flex items-center px-8 py-4 border border-bone/40 text-bone text-sm uppercase tracking-[0.2em] hover:bg-bone hover:text-ink transition-colors"
        >
          Back to home
        </Link>
      </div>
    </section>
  );
};

export default Restaurant;
