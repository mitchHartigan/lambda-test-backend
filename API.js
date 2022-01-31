"use strict";

const mongodb = require("mongodb");
const fs = require("fs");

const DOWNLOAD = async (client, filename) => {
  return new Promise((resolve, reject) => {
    try {
      const db = client.db("mortgagebanking-production");

      const bucket = new mongodb.GridFSBucket(db, {
        chunkSizeBytes: 1024,
        bucketName: "articles-markdown",
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
