import "./setup";
import assert from "node:assert/strict";
import { test } from "node:test";
import { MIME_BY_EXT } from "../lib/config";

test("every supported video extension has a matching upload content type", () => {
  assert.deepEqual(MIME_BY_EXT, {
    ".mp4": "video/mp4",
    ".m4v": "video/mp4",
    ".mov": "video/quicktime",
    ".webm": "video/webm",
    ".avi": "video/x-msvideo",
  });
});
