import mongoose from 'mongoose';
import { GridFSBucket, ObjectId } from 'mongodb';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';

const BUCKET_NAME = 'discussionUploads';
const MAX_FILE_SIZE = 10 * 1024 * 1024;
let bucket;
let bucketConnection;

const getBucket = () => {
  const connection = mongoose.connection;
  if (connection.readyState !== 1 || !connection.db) {
    throw new Error('MongoDB must be connected before accessing file storage.');
  }

  // Recreate the bucket if Mongoose reconnects to a different DB connection.
  if (!bucket || bucketConnection !== connection.db) {
    bucket = new GridFSBucket(connection.db, { bucketName: BUCKET_NAME });
    bucketConnection = connection.db;
  }
  return bucket;
};

export const saveUpload = async ({ buffer, filename, contentType, ownerId, originalName }) => {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0 || buffer.length > MAX_FILE_SIZE) {
    throw Object.assign(new Error('Each photo or file must be between 1 byte and 10 MB.'), {
      statusCode: 400,
    });
  }

  const id = new ObjectId();
  const upload = getBucket().openUploadStreamWithId(id, filename, {
    contentType,
    metadata: {
      ownerId: String(ownerId),
      originalName: String(originalName || '').slice(0, 255),
      contentType,
      storageVersion: 1,
      uploadedAt: new Date(),
    },
  });

  try {
    await pipeline(Readable.from([buffer]), upload);
    return id.toHexString();
  } catch (error) {
    // GridFS can leave a partial files/chunks pair when a stream fails.
    try {
      upload.abort();
    } catch {
      // Preserve the original stream error; abort may fail after stream closure.
    }
    throw error;
  }
};

export const getUploadInfo = async (id) => {
  if (!ObjectId.isValid(id)) return null;
  const files = await getBucket().find({ _id: new ObjectId(id) }).limit(1).toArray();
  return files[0] || null;
};

export const openUploadDownloadStream = (id, options = {}) => {
  if (!ObjectId.isValid(id)) {
    throw Object.assign(new Error('Invalid file identifier.'), { statusCode: 404 });
  }
  return getBucket().openDownloadStream(new ObjectId(id), options);
};

export const deleteUpload = async (id) => {
  if (!ObjectId.isValid(id)) return false;
  const fileId = new ObjectId(id);
  const info = await getBucket().find({ _id: fileId }).limit(1).toArray();
  if (!info.length) return false;
  await getBucket().delete(fileId);
  return true;
};

export const isValidUploadId = (id) => ObjectId.isValid(id);
