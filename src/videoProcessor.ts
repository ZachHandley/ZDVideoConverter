import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

export async function convertVideo(inputBuffer: Buffer, originalFilename: string): Promise<{ buffer: Buffer; filename: string }> {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'video-converter-'));
    const inputPath = path.join(tempDir, originalFilename);
    const outputFilename = `${path.parse(originalFilename).name}.mp4`;
    const outputPath = path.join(tempDir, outputFilename);

    try {
        await fs.writeFile(inputPath, inputBuffer);

        await new Promise<void>((resolve, reject) => {
            ffmpeg(inputPath)
                .outputOptions([
                    '-c:v', 'libx264',
                    '-crf', '23',
                    '-preset', 'slow',
                    '-vf', 'fps=fps=max',
                    '-movflags', '+faststart',
                    '-c:a', 'aac',
                    '-b:a', '192k',
                    '-map_metadata', '0',
                    '-f', 'mp4'
                ])
                .output(outputPath)
                .on('end', () => resolve())
                .on('error', (err: any) => reject(err))
                .run();
        });

        const outputBuffer = await fs.readFile(outputPath);
        return { buffer: outputBuffer, filename: outputFilename };
    } finally {
        await fs.rm(tempDir, { recursive: true, force: true });
    }
}