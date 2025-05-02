import fs from 'fs';
import path from 'path';

/**
 * Pinata configuration interface
 */
interface PinataConfig {
  jwt: string;
}

/**
 * Pinata upload response interface
 */
interface UploadResponse {
  IpfsHash: string;
  PinSize: number;
  Timestamp: string;
  isDuplicate?: boolean;
}

/**
 * Coin metadata structure for IPFS
 */
interface CoinMetadata {
  name: string;
  description: string;
  symbol: string;
  image: string;
  content: {
    uri: string;
    mime: string;
  };
}

/**
 * Reads a local file and converts it to base64
 *
 * @param filePath - Path to the local file
 * @returns Base64 encoded file and mime type
 */
async function readFileAsBase64(
  filePath: string,
): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    fs.readFile(filePath, (err, data) => {
      if (err) {
        reject(new Error(`Failed to read file: ${err.message}`));
        return;
      }

      // Determine mime type based on file extension
      const extension = path.extname(filePath).toLowerCase();
      let mimeType = "application/octet-stream"; // default

      if (extension === ".png") mimeType = "image/png";
      else if (extension === ".jpg" || extension === ".jpeg") mimeType = "image/jpeg";
      else if (extension === ".gif") mimeType = "image/gif";
      else if (extension === ".svg") mimeType = "image/svg+xml";

      const base64 = data.toString("base64");
      resolve({ base64, mimeType });
    });
  });
}

/**
 * Uploads a file to IPFS using Pinata
 *
 * @param params - Configuration and file data
 * @returns Upload response with CID and other details
 */
async function uploadFileToIPFS(params: {
  pinataConfig: PinataConfig;
  fileData: string;
  fileName: string;
  mimeType: string;
}): Promise<UploadResponse> {
  try {
    // When base64 is provided with a data URI prefix, remove it
    let cleanBase64 = params.fileData;
    if (cleanBase64.includes('base64,')) {
      cleanBase64 = cleanBase64.split('base64,')[1];
    }
    
    // Create buffer from base64 data
    const fileBuffer = Buffer.from(cleanBase64, 'base64');
    const fileSize = fileBuffer.length;
    
    console.log(`Uploading ${params.fileName} to Pinata (size: ${fileSize} bytes)...`);
    
    // Instead of using FormData, create a direct file upload with the required headers
    const response = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${params.pinataConfig.jwt}`,
        'Content-Type': 'multipart/form-data; boundary=----PinataBoundary'
      },
      body: createMultipartBody({
        fileName: params.fileName,
        mimeType: params.mimeType,
        fileData: fileBuffer,
        name: params.fileName
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Pinata upload error response:', errorText);
      throw new Error(`Pinata upload failed: ${errorText}`);
    }
    
    const data = await response.json();
    
    return {
      IpfsHash: data.IpfsHash,
      PinSize: data.PinSize,
      Timestamp: data.Timestamp,
      isDuplicate: data.isDuplicate || false
    };
  } catch (error) {
    console.error('Error uploading file to Pinata:', error);
    if (error instanceof Error) {
      throw new Error(`Failed to upload file to IPFS: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Creates a multipart form-data body with proper boundaries
 */
function createMultipartBody(params: {
  fileName: string;
  mimeType: string;
  fileData: Buffer;
  name: string;
}): Buffer {
  const boundary = '----PinataBoundary';
  
  // Create metadata part
  const metadataPart = 
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="pinataMetadata"\r\n` +
    `Content-Type: application/json\r\n\r\n` +
    `${JSON.stringify({ name: params.name })}\r\n`;
  
  // Create options part
  const optionsPart = 
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="pinataOptions"\r\n` +
    `Content-Type: application/json\r\n\r\n` +
    `${JSON.stringify({ cidVersion: 1 })}\r\n`;
  
  // Create file part
  const filePart =
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="file"; filename="${params.fileName}"\r\n` +
    `Content-Type: ${params.mimeType}\r\n\r\n`;
  
  // Create ending boundary
  const endingBoundary = `\r\n--${boundary}--\r\n`;
  
  // Concatenate all parts
  return Buffer.concat([
    Buffer.from(metadataPart, 'utf8'),
    Buffer.from(optionsPart, 'utf8'),
    Buffer.from(filePart, 'utf8'),
    params.fileData,
    Buffer.from(endingBoundary, 'utf8')
  ]);
}

/**
 * Uploads JSON data to IPFS using Pinata
 *
 * @param params - Configuration and JSON data
 * @returns Upload response with CID and other details
 */
async function uploadJsonToIPFS(params: {
  pinataConfig: PinataConfig;
  json: CoinMetadata;
}): Promise<UploadResponse> {
  try {
    const requestBody = {
      pinataOptions: {
        cidVersion: 1,
      },
      pinataMetadata: {
        name: `${params.json.name}-metadata.json`,
      },
      pinataContent: params.json,
    };

    const response = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${params.pinataConfig.jwt}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to upload JSON to IPFS: ${errorText}`);
    }

    const data = await response.json();
    return {
      IpfsHash: data.IpfsHash,
      PinSize: data.PinSize,
      Timestamp: data.Timestamp,
      isDuplicate: data.isDuplicate || false,
    };
  } catch (error) {
    console.error('Error uploading JSON to Pinata:', error);
    if (error instanceof Error) {
      throw new Error(`Failed to upload JSON to IPFS: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Checks if content is successfully pinned on Pinata
 * 
 * @param ipfsHash - IPFS hash to check
 * @param pinataConfig - Pinata configuration
 * @param maxRetries - Maximum number of retries (default: 5)
 * @param retryDelay - Delay between retries in ms (default: 2000)
 * @returns Promise resolving to boolean indicating if content is pinned
 */
export async function checkPinataPin(
  ipfsHash: string,
  pinataConfig: PinataConfig,
  maxRetries = 5,
  retryDelay = 2000
): Promise<boolean> {
  // Clean the hash if it includes ipfs:// prefix
  const hash = ipfsHash.replace('ipfs://', '');
  
  const checkStatus = async (): Promise<boolean> => {
    try {
      const response = await fetch(`https://api.pinata.cloud/data/pinList?status=pinned&hashContains=${hash}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${pinataConfig.jwt}`
        }
      });
      
      if (!response.ok) {
        console.error('Pinata API error:', response.status, response.statusText);
        return false;
      }
      
      const data = await response.json();
      return data.count > 0;
    } catch (error) {
      console.error('Error checking Pinata pin status:', error);
      return false;
    }
  };
  
  // Try with retries
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const isPinned = await checkStatus();
    
    if (isPinned) {
      console.log(`Content ${hash} is pinned on Pinata after ${attempt + 1} attempts`);
      return true;
    }
    
    console.log(`Content ${hash} not yet pinned on Pinata, retrying in ${retryDelay}ms (${attempt + 1}/${maxRetries})`);
    
    if (attempt < maxRetries - 1) {
      await new Promise(resolve => setTimeout(resolve, retryDelay));
    }
  }
  
  console.error(`Content ${hash} not pinned on Pinata after ${maxRetries} attempts`);
  return false;
}

/**
 * Generates a Zora token URI by uploading an image to IPFS and creating metadata
 * 
 * @param params - Parameters for generating the token URI
 * @returns Promise resolving to an object with the URI and hash information
 */
export async function generateZoraTokenUri(params: {
  name: string;
  symbol: string;
  description: string;
  imagePath?: string;
  base64Image?: string;
  fileName?: string;
  mimeType?: string;
  pinataJwt: string;
}): Promise<{
  uri: string;
  metadataHash: string;
  imageHash: string;
}> {
  try {
    const pinataConfig = { jwt: params.pinataJwt };
    
    let base64;
    let mimeType;
    let fileName;
    let imageHash;
    
    try {
      // Use either direct base64 data or read from file
      if (params.base64Image && params.fileName && params.mimeType) {
        base64 = params.base64Image;
        mimeType = params.mimeType;
        fileName = params.fileName;
        
        console.log(`Using provided base64 image data for ${fileName} (${mimeType})`);
      } else if (params.imagePath) {
        // Read from file
        const fileData = await readFileAsBase64(params.imagePath);
        base64 = fileData.base64;
        mimeType = fileData.mimeType;
        fileName = path.basename(params.imagePath);
        
        console.log(`Read image from file: ${params.imagePath}`);
      } else {
        throw new Error("Either base64Image+fileName+mimeType or imagePath must be provided");
      }
      
      // Upload the image to IPFS
      const imageRes = await uploadFileToIPFS({
        pinataConfig,
        fileData: base64,
        fileName,
        mimeType,
      });
      
      imageHash = imageRes.IpfsHash;
      console.log(`Image uploaded to IPFS with hash: ${imageHash}`);
    } catch (error) {
      console.error("Error uploading image to IPFS:", error);
      // Fallback to default image hash if image upload fails
      console.log("Using fallback image for the coin");
      imageHash = "bafkreibvdxl3lunsrggyqdc2ybbsj2yyx44gtzzyo4ypob7wykm7xrjssa";
      mimeType = "image/png";
    }
    
    const ipfsImageUri = `ipfs://${imageHash}`;
    
    // Create and upload the metadata
    const metadata: CoinMetadata = {
      name: params.name,
      description: params.description,
      symbol: params.symbol,
      image: ipfsImageUri,// ipfsImageUri,
      content: {
        uri: ipfsImageUri,// ipfsImageUri, //.replace('ipfs://', 'https://ipfs.io/ipfs/'),
        mime: mimeType || "image/png",
      },
    };
    
    const metadataRes = await uploadJsonToIPFS({
      pinataConfig,
      json: metadata,
    });
    
    const metadataHash = metadataRes.IpfsHash;
    const uri = `ipfs://${metadataHash}`;
    
    // Verify content is pinned
    await checkPinataPin(imageHash, pinataConfig);
    await checkPinataPin(metadataHash, pinataConfig);
    
    return { uri, metadataHash, imageHash };
  } catch (error) {
    console.error('Error generating Zora token URI:', error);
    if (error instanceof Error) {
      throw new Error(`Failed to generate Zora token URI: ${error.message}`);
    }
    throw error;
  }
} 