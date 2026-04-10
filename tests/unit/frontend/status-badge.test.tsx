import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StatusBadge } from "~/components/ui/status-badge";

describe("StatusBadge", () => {
  it("renders capitalized running status", () => {
    render(<StatusBadge status="running" />);
    expect(screen.getByText("Running")).toBeInTheDocument();
  });

  it("falls back styling for unknown status", () => {
    render(<StatusBadge status="unknown-state" />);
    expect(screen.getByText("Unknown-state")).toBeInTheDocument();
  });
});
