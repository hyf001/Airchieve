import React from "react";

import { type BookPlayerPayload } from "@/entities/book";
import { BookPlayer } from "./BookPlayer";

export const ReadonlyBookPlayer: React.FC<{ payload: BookPlayerPayload }> = ({ payload }) => <BookPlayer payload={payload} readonly />;
