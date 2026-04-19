// Importing the necessary modules
import { NextResponse } from 'next/server';

// Route handler for capturing content
export async function POST(request: Request) {
    const { url, headers } = await request.json();
    console.log('Captured URL:', url);

    // Setting up options for the fetch request
    const fetchOptions = {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${process.env.GITHUB_TOKEN}`, // Updated to use GITHUB_TOKEN
            'Accept': 'application/vnd.github.v3+json'
        }
    };

    // Fetch content from the provided URL
    const response = await fetch(url, fetchOptions);
    const data = await response.json();

    // Responding with the captured data
    return NextResponse.json(data);
}