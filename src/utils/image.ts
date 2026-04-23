import loadImage from "blueimp-load-image";

export const resizeImage = (file: File, maxDimension: number = 1280): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    loadImage(
      file,
      (canvas) => {
        if (canvas instanceof HTMLCanvasElement) {
          canvas.toBlob(
            (blob) => {
              if (blob) {
                resolve(blob);
              } else {
                reject(new Error("Canvas to Blob failed"));
              }
            },
            "image/jpeg",
            0.85,
          );
        } else {
          reject(new Error("Image loading failed"));
        }
      },
      {
        maxWidth: maxDimension,
        maxHeight: maxDimension,
        canvas: true,
        orientation: true,
      },
    );
  });
};
