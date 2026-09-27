import { Component } from "react";

// A page that throws used to take the whole site white. Now it reports itself and
// the rest of the site, nav included, stays up.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Left in the console on purpose: it is what tells me where to look.
    console.error("Page error:", error, info);
  }

  componentDidUpdate(prev) {
    // A different page clears the last error, so navigating away recovers.
    if (prev.routeKey !== this.props.routeKey && this.state.error) this.setState({ error: null });
  }

  render() {
    if (this.state.error) {
      return (
        <div className="w-full border border-black bg-white p-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-neutral-900">This page hit an error</p>
          <p className="mt-1 text-[11px] leading-[15px] text-neutral-600">
            {String(this.state.error?.message || this.state.error)}
          </p>
          <button
            onClick={() => this.setState({ error: null })}
            style={{ color: "#C1440E" }}
            className="mt-2 text-[11px] font-bold uppercase tracking-wide underline underline-offset-2"
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
