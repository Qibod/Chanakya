// Allow build scripts for trusted native packages
function readPackage(pkg) {
  return pkg;
}

module.exports = { hooks: { readPackage } };
