import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// Unmount the React tree between tests so queries never see a previous render.
afterEach(() => cleanup());
