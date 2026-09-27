import { Component } from "react";
import { ErrorState } from "./UI";

// Keep navigation and theme controls available if an unexpected rendering error occurs.
export default class WorkspaceBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error) {
    console.error("Meridian view failed", error);
  }
  render() {
    if (this.state.failed)
      return (
        <ErrorState
          title="This view could not be displayed"
          error={{
            message:
              "An unexpected display error occurred. Retry this view or open another workspace from the navigation.",
          }}
          retry={this.props.onRetry}
        />
      );
    return this.props.children;
  }
}
