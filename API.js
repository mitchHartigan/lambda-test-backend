"use strict";

const mongodb = require("mongodb");
const fs = require("fs");

const DOWNLOAD = async (client, filename) => {
  return new Promise((resolve, reject) => {
    const db = client.db("mortgagebanking-production");

    const bucket = new mongodb.GridFSBucket(db, {
      chunkSizeBytes: 1024,
      bucketName: "articles-markdown",
    });

    bucket
      .openDownloadStreamByName(filename)
      .pipe(fs.createWriteStream(`./temp/markdown/${filename}`))
      .on("error", (err) => console.log(err))
      .on("finish", () => {
        console.log(`Finished download for ${filename}`);
        resolve();
      });
  });
};

module.exports = { DOWNLOAD };