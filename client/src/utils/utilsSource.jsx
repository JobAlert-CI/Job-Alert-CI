const getImgSource = (name, transp = false) => {
  const nameLowerCase = name.toLowerCase()
  switch (nameLowerCase) {
    case "novojob":
      return transp ? "/LogoSource/novojobT.png" : "/LogoSource/novojob.svg"
    case "linkedin":
      return transp ? "/LogoSource/linkedinT.png" : "/LogoSource/linkedin.png"
    case "goafrica":
    case "go africa online":
      return transp ? "/LogoSource/goafricaT.png" : "/LogoSource/goafrica.svg"
    case "emploidakar ci":
    case "emploidakar":
      return transp ? "/LogoSource/emploidakarT.png" : "/LogoSource/emploidakar.svg"
    default:
      return transp ? "/LogoSource/novojobT.png" : "/LogoSource/novojob.png"
  }
}


const getUrlSource = (name) => {
  const nameLowerCase = name.toLowerCase()
  switch (nameLowerCase) {
    case "novojob":
      return "https://www.novojob.com/cote-d-ivoire/"
    case "linkedin":
      return "https://www.linkedin.com/"
    case "goafrica":
      return "https://www.goafricaonline.com/fr"
    case "emploidakar ci":
    case "emploidakar":
      return "https://www.emploidakar.com/"
    default:
      return "https://www.novojob.com/cote-d-ivoire/"
  }
}


export { getImgSource, getUrlSource }
