import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatCard } from "~/components/ui/stat-card";

describe("StatCard", () => {
  it("renders title and value", () => {
    render(<StatCard title="Sites" value={3} />);
    expect(screen.getByText("Sites")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("renders optional subtitle", () => {
    render(
      <StatCard title="CPU" value="12%" subtitle="Last minute average" />,
    );
    expect(screen.getByText("Last minute average")).toBeInTheDocument();
  });
});
