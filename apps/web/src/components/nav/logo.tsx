import { Cookie } from "lucide-react";
import { Link } from "react-router-dom";

const Logo = () => {
  return (
    <div data-slot="badge" className="flex items-center gap-2 p-2">
      <Link to="/">
        <div className="rounded-full border-dotted border-border">
          <Cookie className="size-6" />
        </div>
      </Link>
    </div>
  );
};

export { Logo };
