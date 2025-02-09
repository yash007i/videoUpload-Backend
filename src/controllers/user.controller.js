import {asyncHandler} from "../utils/asyncHandler.js"
import { ApiError } from "../utils/ApiError.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import {User} from "../models/user.models.js"
import { uploadOnCloudinary } from "../utils/fileUpload.servies.js"
import jwt from "jsonwebtoken"

const generateAccessAndRefreshTokens = async (userId) => {
    try {
        const user = await User.findById(userId)
        const accessToken =  user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()

        user.refreshToken = refreshToken
        await user.save({ validateBeforeSave : false })

        return { accessToken, refreshToken }

    } catch (error) {
        throw new ApiError(500, "Something went wrong, while generated tokens")
    }
}


const registerUser = asyncHandler( async (req,res) => {
    // Step to follow
    // get the user data from frontend
    // validation - not empty
    // check if user already exists : email, username
    // check for image, check for avatar
    // upload them to coludinary , avatar
    // create user object - create entry in DB  
    // remove password and refresh token filed from response
    // check for user creation
    // return response 

    const {fullName, email, username, password} = req.body
    console.log(req.body);
    
    if(
        [fullName, email, username, password].some((field) => 
        field?.trim() === "" )
    ){
        throw new ApiError(400, "All fields are required");        
    }

    const existedUser = await User.findOne({
        $or : [{ username }, { email }]
    })

    if(existedUser){
        throw new ApiError(409, "User is alredy exist with this email or username")
    }

    const avatarLocalPath = req.files?.avatar[0]?.path    
    const coverImageLocalPath = req.files?.coverImage[0]?.path

    if(!avatarLocalPath){
        throw new ApiError(400, "Avatar must required")
    }
    console.log(coverImageLocalPath);
    const avatar = await uploadOnCloudinary(avatarLocalPath);
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)
    
    
    if(!avatar){
        throw new ApiError(400, "Avatar file is required")
    }

    const user = await User.create({
        fullName,
        avatar : avatar.url,
        coverImage : coverImage.url || "",
        email,
        password,
        username : username.toLowerCase()
    })
    
    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )

    if(!createdUser){
        throw new ApiError(500, "Something went wrong, while registering the user")
    }

    return res.status(201).json(
        new ApiResponse(200, createdUser, "User rigister successfully")
    )

})

const loginUser = asyncHandler( async (req,res) => {
    // Follow below step

    // req body -> data
    // username or email
    // find the user
    // password check
    // access token and refresh token generated
    // send a securely cookie
    // send response

    const {username, email, password} = req.body

    if(!(username || email)){
        throw new ApiError(400, "Username or Email is required")
    }

    const user = await User.findOne({
        $or : [{username}, {email}]
    })

    if(!user){
        throw new ApiError(404, "User does not exist")
    }

    const isPasswordValid = await user.isPasswordCorrect(password)

    if(!isPasswordValid){
        throw new ApiError(401, "Password is invalid")
    }

    const { accessToken, refreshToken } =  await generateAccessAndRefreshTokens(user._id)

    const loggedInUser = await User.findById(user._id).select("-password -refreshToken")

    const options = {
        httpOnly: true, 
        secure:  true
    }// modified by server only , not in frontend. Bydefault modifiable througth frontend.

    return res.status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
        new ApiResponse(200, 
            {
                user: loggedInUser, accessToken, refreshToken // user save it self token in mobile app devlopnment
            },
            "User logged in successfully"
        )
    )

})

const logoutUser = asyncHandler( async (req,res) => {
    // Find user
    // clear cookie -> accessToken and refreshToken 
    // DB remove refreshToken

    await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                refreshToken: undefined
            }
        },
        {
            new: true // res new updated value , not old.
        }
    )

    const options ={
        httpOnly: true,
        secure: true
    }

    return res.status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(
        new ApiResponse(200,{},"User logout successfully")
    )
})

const refreshAccessToken = asyncHandler ( async (req,res) => {
    // get refreshToken when fronted hit this end point
    // check refreshToken
    // verify token
    // get user from db
    // check both token -> incomeing and user
    // generate new token and pass in cookies
    const incomeingRefreshToken = req.cookies.refreshToken || req.body.refreshToken

    if(!incomeingRefreshToken){
        throw new ApiError(401, "unauthorized Request")
    }

    try {
        const decodedToken = jwt.verify(
            incomeingRefreshToken, process.env.REFRESH_TOKEN_SECRET
        )
    
        const user = await User.findById(decodedToken?._id)
    
        if(!user){
            throw new ApiError(401, "Invalid refresh Token")
        }
    
        if(incomeingRefreshToken !== user?.refreshToken){
            throw new ApiError(401, "Refresh Token is expired or used")
        }
    
        const options = {
            httpOnly: true,
            secure: true
        }
        const {accessToken , newRefreshToken} = await generateAccessAndRefreshTokens(user._id)
    
        return res.status(200)
        .cookie("accessToken",accessToken, options)
        .cookie("refreshToken", newRefreshToken, options)
        .json(
            new ApiResponse(
                200,
                {accessToken, refreshToken: newRefreshToken},
                "Access token refresh successfully"
            )
        )
    } catch (error) {
        throw new ApiError(401, "Invalid refresh token in catch part" )
    }
})



export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
}