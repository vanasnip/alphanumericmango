#!/bin/bash

# Setup script for Coqui TTS environment
echo "Setting up Coqui TTS environment..."

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    echo "Creating Python virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
source venv/bin/activate

# Upgrade pip
pip install --upgrade pip

# Install requirements
echo "Installing Coqui TTS dependencies..."
pip install -r requirements.txt

# Download a lightweight English model for testing
echo "Downloading English TTS model..."
python -c "from TTS.api import TTS; tts = TTS('tts_models/en/ljspeech/tacotron2-DDC')"

echo "Coqui TTS setup complete!"