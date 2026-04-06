import mongoose from "mongoose";

const userSchema=new mongoose.Schema({
    name:{
        type:String,
        required:true
    },
    email:{
        type:String,
        required:true,
        unique:true
    },
    password:{
        type:String,
        required:true
    },
    assistantName:{
        type:String
    },
     assistantImage:{
        type:String
    },
    history:[
        {type:String}
    ],
    snippets:[
        {
            language:{type:String},
            filename:{type:String},
            code:{type:String},
            createdAt:{type:Date,default:Date.now}
        }
    ]

},{timestamps:true})

const User=mongoose.model("User",userSchema)
export default User