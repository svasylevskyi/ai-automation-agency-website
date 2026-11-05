import sharp from "sharp";
import { HttpError } from "./http";

export async function prepareLogo(input: Buffer) {
  const png = input
    .subarray(0, 8)
    .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const jpeg = input[0] === 255 && input[1] === 216 && input[2] === 255;
  const webp =
    input.subarray(0, 4).toString() === "RIFF" &&
    input.subarray(8, 12).toString() === "WEBP";
  if (!png && !jpeg && !webp)
    throw new HttpError(
      400,
      "Choose a PNG, JPEG or WebP image. SVG uploads are not accepted.",
    );
  try {
    const { data, info } = await sharp(input, {
      limitInputPixels: 16000000,
      animated: false,
    })
      .rotate()
      .resize({
        width: 1024,
        height: 512,
        fit: "inside",
        withoutEnlargement: true,
      })
      .png()
      .toBuffer({ resolveWithObject: true });
    return { data, width: info.width, height: info.height };
  } catch {
    throw new HttpError(
      400,
      "The image could not be read. Use a PNG, JPEG or WebP below 2 MB and 16 megapixels.",
    );
  }
}
