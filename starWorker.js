self.onmessage = function(e) {
  const { width, height } = e.data;
  const starCount = 1500000;
  const starData = new Float32Array(starCount * 4);
  const colorData = new Uint8Array(starCount);
  for (let i = 0; i < starCount; i++) {
    starData[i * 4] = Math.random() * width;
    starData[i * 4 + 1] = Math.random() * height;
    starData[i * 4 + 2] = Math.random() * 1.5 + 0.5;
    starData[i * 4 + 3] = Math.random() * 0.5 + 0.5;
    colorData[i] = Math.floor(Math.random() * 4);
  }
  const planetColors = ['#6c5ce7', '#e17055', '#00b894', '#0984e3', '#fdcb6e'];
  const planets = [];
  for (let i = 0; i < 50; i++) {
    planets.push({
      x: Math.random() * width,
      y: Math.random() * height,
      r: 40 + Math.random() * 80,
      color: planetColors[Math.floor(Math.random() * planetColors.length)],
    });
  }
  self.postMessage({ starData, colorData, planets }, [starData.buffer, colorData.buffer]);
};
