import { Link } from "react-router-dom";

const Footer = () => {
  return (
    <footer className="bg-foreground border-t border-background/10">
      <div className="container mx-auto px-6 py-20">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
          {/* Brand */}
          <div className="space-y-6">
            <div className="text-xl text-background">
              <span>Clinical</span>
              <span className="font-semibold">Hours</span>
            </div>
            <p className="text-sm text-background/50 font-light leading-relaxed">
              Empowering pre-med students to find and secure clinical opportunities.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-xs uppercase tracking-[0.2em] text-background/40 mb-6">Quick Links</h3>
            <ul className="space-y-4 text-sm">
              <li>
                <Link to="/opportunities" className="text-background/70 hover:text-background transition-colors font-light">
                  Find Opportunities
                </Link>
              </li>
              <li>
                <Link to="/map" className="text-background/70 hover:text-background transition-colors font-light">
                  Map View
                </Link>
              </li>
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h3 className="text-xs uppercase tracking-[0.2em] text-background/40 mb-6">Resources</h3>
            <ul className="space-y-4 text-sm">
              <li>
                <Link to="/contact" className="text-background/70 hover:text-background transition-colors font-light">
                  Contact
                </Link>
              </li>
              <li>
                <Link to="/terms" className="text-background/70 hover:text-background transition-colors font-light">
                  Terms & Conditions
                </Link>
              </li>
              <li>
                <Link to="/privacy" className="text-background/70 hover:text-background transition-colors font-light">
                  Privacy Policy
                </Link>
              </li>
            </ul>
          </div>

          {/* Connect */}
          <div>
            <h3 className="text-xs uppercase tracking-[0.2em] text-background/40 mb-6">Connect</h3>
            <ul className="space-y-4 text-sm">
              <li>
                <a
                  href="mailto:support@clinicalhours.org"
                  className="text-background/70 hover:text-background transition-colors font-light"
                >
                  support@clinicalhours.org
                </a>
              </li>
              <li>
                <a
                  href="https://linkedin.com/company/clinicalhours"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-background/70 hover:text-background transition-colors font-light"
                >
                  LinkedIn
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-20 pt-8 border-t border-background/10 text-center">
          <p className="text-xs text-background/40 uppercase tracking-[0.2em]">
            &copy; {new Date().getFullYear()} <span>Clinical</span><span className="font-semibold">Hours</span>. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
