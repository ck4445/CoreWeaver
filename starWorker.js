self.onmessage = function(e) {
  const { width, height } = e.data;
  const starColors = ['#ffffff', '#ffe5b4', '#b0e0e6', '#dcdcdc'];
  const sampleArea = 1920 * 1080;
  const starCount = Math.ceil(width * height * 20 / sampleArea);
  const stars = [];
  for (let i = 0; i < starCount; i++) {
    stars.push({
      x: Math.random() * width,
      y: Math.random() * height,
      r: Math.random() * 1.5 + 0.5,
      color: starColors[Math.floor(Math.random() * starColors.length)],
      a: Math.random() * 0.5 + 0.5,
    });
  }
  postMessage(stars);
};

