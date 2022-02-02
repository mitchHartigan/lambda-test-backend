"use strict";

const mongodb = require("mongodb");
const fs = require("fs");

const DOWNLOAD = async (client, filename, environment, bucketName) => {
  return new Promise((resolve, reject) => {
    try {
      const db = client.db(`mortgagebanking-${environment}`);

      const bucket = new mongodb.GridFSBucket(db, {
        chunkSizeBytes: 1024,
        bucketName: bucketName,
      });

      bucket
        .openDownloadStreamByName(filename)
        .pipe(fs.createWriteStream(`/tmp/${filename}`))
        .on("error", (err) => console.log(err))
        .on("finish", () => {
          console.log(`Finished download for ${filename}`);
          resolve(true);
        });
    } catch {
      resolve(false);
    }
  });
};

module.exports = { DOWNLOAD };
